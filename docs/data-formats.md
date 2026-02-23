# Data Formats

All Claude data lives under `~/.claude/`. The Rust backend reads it directly — no Claude CLI API involved.

## Path encoding

Claude encodes project paths as directory names under `~/.claude/projects/`:

```
C:\dev\foo   →   C--dev-foo
```

Rules:
- `:\` → `--`
- `\` → `-`
- Forward slash `/` → `-`

Implementation: `src-tauri/src/data/path_encoding.rs`

**Windows gotcha**: Path comparison must be case-insensitive. Normalize both sides to lowercase before comparing.

## Sessions

```
~/.claude/projects/{encoded-path}/
├── sessions-index.json    ← list of all sessions for this project
└── {session-id}.jsonl     ← one JSON object per line (transcript)
```

### sessions-index.json

```json
[
  {
    "id": "abc123",
    "title": "fix auth bug",
    "created_at": "2026-02-21T10:00:00Z",
    "updated_at": "2026-02-21T11:30:00Z",
    "isSidechain": false
  }
]
```

**Filter**: Skip entries where `isSidechain: true` — these are internal sub-sessions not meant for display.

### transcript JSONL

Each line is one of:

```json
{ "type": "user", "content": "fix the login bug" }
{ "type": "assistant", "content": [{ "type": "text", "text": "..." }] }
{ "type": "tool_use", "name": "bash", "input": { "command": "..." } }
{ "type": "tool_result", "content": "..." }
```

Fields are often optional — use `#[serde(default)]` on all Rust structs.

## Teams

```
~/.claude/teams/{team-name}/
├── config.json        ← team metadata + members
└── inboxes/
    └── {agent-name}.json   ← message array for this agent
```

### config.json

```json
{
  "name": "my-team",
  "created": 1708512000000,        ← milliseconds epoch (not ISO8601!)
  "members": [
    {
      "name": "researcher",
      "agentId": "uuid-...",
      "agentType": "general-purpose"
    }
  ]
}
```

**Timestamp gotcha**: Team config uses **millisecond epoch integers**. Sessions use **ISO8601 strings**. Handle both.

**Missing config.json**: A team can exist with only an `inboxes/` directory and no `config.json` (e.g., when only inboxes have been created). Handle `None` gracefully.

### inboxes/{agent}.json

```json
[
  {
    "id": "uuid",
    "from": "user",
    "to": "researcher",
    "content": "investigate X",
    "timestamp": "2026-02-21T10:00:00Z",
    "read": false
  }
]
```

This is a JSON **array** (not JSONL). Written atomically: write to temp file, then rename.

## Tasks

```
~/.claude/tasks/{team-name}/{id}.json
```

```json
{
  "id": "1",
  "subject": "Research auth patterns",
  "description": "...",
  "status": "in_progress",
  "owner": "researcher",
  "blockedBy": []
}
```

**Filter**: Skip tasks where `status: "deleted"`.

## Plans

```
~/.claude/plans/{plan-name}.md
```

Plain markdown files. Loaded as raw strings and rendered in the PlansPanel.

## Todos

```
~/.claude/todos/{id}.json
```

```json
{
  "id": "uuid",
  "content": "Review PR #42",
  "completed": false,
  "created_at": "2026-02-21T10:00:00Z"
}
```

## File watcher

The Rust `notify` crate (v8) watches `~/.claude/` recursively using `ReadDirectoryChangesW` on Windows. Events are debounced per category and emitted to the frontend as `"claude-fs-change"` Tauri events.

**Skip `.lock` files**: Claude writes `.lock` companion files during writes. Ignore any path ending in `.lock`.

## Hook events (live session tracking)

```
~/.claude/ide/
└── hook-events.jsonl    ← append-only, one JSON line per hook event
```

### hook-events.jsonl line schema

Each line is a `HookEvent` JSON object:

```json
{
  "hook_event_name": "SessionStart",
  "session_id": "abc123-uuid",
  "cwd": "C:\\dev\\myproject",
  "source": "startup",
  "model": "claude-opus-4-6",
  "transcript_path": "C:\\Users\\...\\projects\\...\\abc123.jsonl",
  "agent_id": null,
  "agent_type": null,
  "reason": null,
  "last_assistant_message": null,
  "stop_hook_active": null
}
```

Possible `hook_event_name` values and their key fields:

| Event | Key fields |
|-------|-----------|
| `SessionStart` | `session_id`, `cwd`, `source` (startup\|resume\|clear\|compact), `model` |
| `SessionEnd` | `session_id`, `reason` (clear\|logout\|other) |
| `SubagentStart` | `session_id`, `agent_id`, `agent_type` |
| `SubagentStop` | `session_id`, `agent_id` |
| `Stop` | `session_id`, `stop_hook_active` |

All fields except `hook_event_name` and `session_id` are optional (`null` if not applicable).

### State reconstruction

`build_active_sessions(events)` replays events in order to reconstruct current state:
- `SessionStart` → create/update `ActiveSession { is_active: true }`
- `SessionEnd` / `Stop` → `is_active = false`
- `SubagentStart` → push to `session.subagents`
- `SubagentStop` → remove from `session.subagents` by `agent_id`

### Hook command (no hardcoded username)

The PowerShell command written into `~/.claude/settings.json` uses `$env:USERPROFILE` so it resolves the home directory at runtime — no username appears in the config file:

```
powershell -NoProfile -Command "$d=[Console]::In.ReadToEnd(); Add-Content (Join-Path $env:USERPROFILE '.claude\ide\hook-events.jsonl') $d"
```

Claude CLI pipes the hook event JSON to the command's stdin. The script reads it all and appends to the JSONL file.
