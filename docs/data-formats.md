# Data Formats

All Claude data lives under `~/.claude/`. The Rust backend reads it directly — no Claude CLI API involved.

## Path encoding

Claude encodes project paths as directory names under `~/.claude/projects/`:

```
C:\dev\foo   ->   C--dev-foo
```

Rules:
- Forward slash `/` is first normalized to `\`
- `:\` -> `--`
- Remaining `\` -> `-`

Implementation: `src-tauri/src/data/path_encoding.rs`

**Windows gotcha**: Path comparison must be case-insensitive. Normalize both sides to lowercase before comparing.

## Sessions

```
~/.claude/projects/{encoded-path}/
+-- sessions-index.json    <-- wrapper object with entries array
+-- {session-id}.jsonl     <-- one JSON object per line (transcript)
```

### sessions-index.json

The file is a JSON **object** with an `entries` array (not a bare array):

```json
{
  "entries": [
    {
      "sessionId": "abc123",
      "firstPrompt": "fix the auth bug",
      "summary": "Fixed authentication...",
      "messageCount": 12,
      "created": "2026-02-21T10:00:00Z",
      "modified": "2026-02-21T11:30:00Z",
      "gitBranch": "main",
      "projectPath": "C:\\dev\\myproject",
      "isSidechain": false
    }
  ]
}
```

All fields except `sessionId` use `#[serde(default)]` — they may be missing.

**Filter**: Skip entries where `isSidechain: true` — these are internal sub-sessions not meant for display.

**Fallback**: When `sessions-index.json` doesn't exist, `sessions.rs` scans all `.jsonl` files in the directory and builds `SessionEntry` structs from the first 30 lines of each file, extracting `gitBranch`, `cwd`, timestamps, first user prompt, and message count from the JSONL envelopes.

### Transcript JSONL

Each line is a `TranscriptEnvelope` with a `type` field and optional `timestamp` and `message`:

```json
{ "type": "user", "timestamp": "...", "message": { "content": "fix the login bug" } }
{ "type": "assistant", "timestamp": "...", "message": { "content": [{ "type": "text", "text": "..." }] } }
{ "type": "system", "message": { "content": "..." } }
{ "type": "progress", "content": "..." }
```

The `message.content` field can be either a plain string (`MessageContent::Text`) or an array of content blocks (`MessageContent::Blocks`). Content blocks have types: `text`, `tool_use` (with `name` and `input`), and `tool_result` (with `content`).

Lines may also contain envelope-level fields: `sessionId`, `gitBranch`, `cwd`, `timestamp`, and `type`. Lines with `type: "file-history-snapshot"` are skipped during session scanning.

Fields are often optional — use `#[serde(default)]` on all Rust structs.

**Incremental reading**: `TranscriptReader` tracks a byte `last_offset` and only parses new lines on subsequent reads. It caps at 5000 items, draining oldest items when exceeded.

## Projects

`data/projects.rs` discovers all projects from `~/.claude/projects/`:

```rust
ProjectInfo {
    id: String,           // encoded dir name
    path: String,         // real filesystem path (forward slashes)
    name: String,         // last path component
    session_count: usize, // non-sidechain sessions
    last_modified: Option<String>,  // epoch seconds as string
    is_worktree: bool,    // .git is a file, not a directory
}
```

Projects whose real code directory no longer exists on disk are excluded from the main list. A separate `discover_orphaned_projects` function returns only those missing projects.

## Teams

```
~/.claude/teams/{team-name}/
+-- config.json        <-- team metadata + members
+-- inboxes/
    +-- {agent-name}.json   <-- message array for this agent
```

### config.json

```json
{
  "name": "my-team",
  "description": "Team description",
  "createdAt": 1708512000000,
  "leadAgentId": "uuid-...",
  "leadSessionId": "uuid-...",
  "members": [
    {
      "name": "researcher",
      "agentId": "uuid-...",
      "agentType": "general-purpose",
      "model": "claude-sonnet-4-6",
      "cwd": "C:\\dev\\myproject",
      "color": "#58A6FF",
      "joinedAt": 1708512000000,
      "tmuxPaneId": "%1",
      "backendType": "claude_code_sdk",
      "prompt": "You are a researcher...",
      "planModeRequired": false,
      "subscriptions": ["task_updates"]
    }
  ]
}
```

All fields use camelCase (via `#[serde(rename_all = "camelCase")]`) and `#[serde(default)]`.

**Timestamp gotcha**: Team config uses **millisecond epoch integers**. Sessions use **ISO8601 strings**. Handle both.

**Missing config.json**: A team can exist with only an `inboxes/` directory and no `config.json` (e.g., when only inboxes have been created). Handle `None` gracefully — `TeamConfig::default()` is used.

**CWD filtering**: `load_teams` accepts an optional `project_cwd`. When provided, it filters teams by matching any member's `cwd` against the project path (case-insensitive, slash-normalized). If no teams match the CWD filter, it falls back to returning all teams.

### inboxes/{agent}.json

```json
[
  {
    "from": "user",
    "text": "investigate X",
    "timestamp": "2026-02-21T10:00:00Z",
    "read": false,
    "color": "#58A6FF"
  }
]
```

This is a JSON **array** (not JSONL). Written atomically: write to temp file `.json.tmp`, then rename.

The `send_inbox_message` function adds `from`, `text`, `timestamp` (RFC3339), `read: false`, and optional `color`.

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
  "blocks": ["3"],
  "blockedBy": ["0"],
  "activeForm": "Researching auth patterns",
  "metadata": { "priority": "high" }
}
```

All fields use camelCase. `status` values: `pending`, `in_progress`, `completed`, `deleted`.

**Filter**: Skip tasks where `status: "deleted"`. Also skip `.lock` files in the tasks directory.

**Sorting**: Tasks are sorted numerically by `id` when parseable as u32, falling back to string comparison.

## Plans

```
~/.claude/plans/{plan-name}.md
```

Markdown files parsed into structured data:

```rust
PlanFile {
    filename: String,               // e.g. "enchanted-herding-koala.md"
    title: String,                  // extracted from first "# " heading, or "(untitled)"
    modified: SystemTime,           // serialized as epoch seconds
    lines: Vec<MarkdownLine>,       // each line classified by kind
}

MarkdownLine {
    kind: MarkdownLineKind,  // Heading | CodeFence | CodeBlock | Normal
    text: String,
}
```

Plans are sorted newest-first by `modified` timestamp.

## Todos

```
~/.claude/todos/{filename}.json
```

Each file contains a JSON **array** of todo items (not individual files per todo):

```json
[
  {
    "content": "Review PR #42",
    "status": "pending",
    "activeForm": "Reviewing PR #42"
  }
]
```

All fields are optional (`#[serde(default)]`). Empty files are skipped. Files are sorted alphabetically by filename.

## Git data

`data/git.rs` provides git operations by shelling out to `git`:

- `load_git_status(cwd)` — runs `git status --porcelain`, returns `GitStatus { staged, unstaged, untracked }` where each entry has `path`, `section`, and `status_char`
- `load_diff(cwd, file_path, staged)` — runs `git diff` (with `--cached` if staged), returns parsed `DiffLine` items with kinds: `Header`, `Hunk`, `Add`, `Remove`, `Context`
- `load_current_branch(cwd)` — runs `git rev-parse --abbrev-ref HEAD`
- `load_branches(cwd)` — runs `git branch --format=%(refname:short)`

## File watcher

The Rust `notify` crate (v8) watches `~/.claude/` recursively using `ReadDirectoryChangesW` on Windows. Events are debounced per category and emitted to the frontend as `"claude-fs-change"` Tauri events.

**Skip `.lock` files**: Claude writes `.lock` companion files during writes. Ignore any path ending in `.lock`.

## Hook events (live session tracking)

```
~/.claude/theassociate/
+-- hook.js              <-- Node.js script that appends stdin to JSONL
+-- hook-events.jsonl    <-- append-only, one JSON line per hook event
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
- `SessionStart` -> create/update `ActiveSession { is_active: true }`
- `SessionEnd` / `Stop` -> `is_active = false`
- `SubagentStart` -> push to `session.subagents`
- `SubagentStop` -> remove from `session.subagents` by `agent_id`

### Hook script

The Node.js script (`~/.claude/theassociate/hook.js`) reads all of stdin on `end` and appends the trimmed JSON line to `hook-events.jsonl`. Claude CLI pipes the hook event JSON to the command's stdin.

The hook command registered in settings.json is: `node C:/Users/{user}/.claude/theassociate/hook.js` (forward slashes to avoid backslash escaping issues with cmd.exe).
