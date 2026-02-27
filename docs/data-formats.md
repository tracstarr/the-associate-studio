# Data Formats

All Claude data lives under `~/.claude/`. The Rust backend reads it directly — no Claude CLI API involved.

## Path encoding

Claude encodes project paths as directory names under `~/.claude/projects/`:

```
C:\dev\foo        ->  C--dev-foo
C:\dev\apex_3.11.0  ->  C--dev-apex-3-11-0
```

Rules:
- Forward slash `/` is first normalized to `\`
- `:\` -> `--`
- Remaining `\` -> `-`
- `.` -> `-`
- `_` -> `-`

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

The Rust `notify` crate (v8) watches specific subdirectories of `~/.claude/` using `ReadDirectoryChangesW` on Windows:

| Directory | Mode | Tauri events |
|-----------|------|-------------|
| `teams/` | Recursive | `team-changed`, `inbox-changed` |
| `tasks/` | Recursive | `task-changed` |
| `projects/` | Recursive | `session-changed`, `transcript-updated` |
| `todos/` | NonRecursive | `todos-changed` |
| `plans/` | NonRecursive | `plans-changed` |
| `theassociate/` | NonRecursive | `hook-event`, `session-summary` |

Events are classified by matching path components (direct child of `.claude/`) via `is_claude_child()` and emitted as targeted Tauri events. The frontend's `useClaudeWatcher()` hook listens for these events and invalidates the corresponding TanStack Query caches.

## Hook events (live session tracking)

```
~/.claude/theassociate/
+-- hook.js              <-- Node.js script that appends stdin to JSONL
+-- hook-events.jsonl    <-- append-only, one JSON line per hook event
+-- watcher-state.json   <-- persisted byte offsets (see Watcher state section)
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

## Watcher state

```
~/.claude/theassociate/
+-- watcher-state.json    <-- persisted byte offsets for file watchers
```

### watcher-state.json

```json
{
  "hook_offsets": {
    "C:\\Users\\Keith\\.claude\\theassociate\\hook-events.jsonl": 4096
  }
}
```

`WatcherState` (`data/watcher_state.rs`) persists a `HashMap<String, u64>` mapping file paths to byte offsets. On startup, if `hook-events.jsonl` exists but has no saved offset, the current file length is stored (skipping historical events). The offset is persisted before processing new lines for crash safety.

## Session summaries

```
~/.claude/projects/{encoded-path}/
+-- {session-id}-summary-001.md    <-- first completion summary
+-- {session-id}-summary-002.md    <-- second, etc.
```

Summaries are extracted from `Stop` hook events when `last_assistant_message` qualifies as a completion summary. The file is plain markdown content from Claude's final assistant message.

### SummaryFile model

```rust
SummaryFile {
    session_id: String,   // the session that produced the summary
    filename: String,     // e.g. "abc123-summary-001.md"
    created: u64,         // Unix timestamp (seconds) from file metadata
    preview: String,      // first 200 characters
}
```

### Tauri event

When a summary is saved, a `session-summary` event is emitted:

```json
{
  "session_id": "abc123-uuid",
  "project_path": "C:\\dev\\myproject",
  "project_dir": "C--dev-myproject",
  "filename": "abc123-uuid-summary-001.md",
  "preview": "## Summary\n\nFixed the auth bug..."
}
```

The frontend listens for this event and invalidates the `["summaries"]` query cache.

## Notes

Notes are stored as individual JSON files, one per note.

```
~/.claude/notes/{id}.json                              <-- global notes
~/.claude/projects/{encoded-path}/notes/{id}.json     <-- per-project notes
```

### Note schema

```json
{
  "id": "m5xj2-ab3cd",
  "title": "Auth bug investigation",
  "content": "## Findings\n\nThe token is...",
  "projectPath": "C:\\dev\\myapp",
  "fileRefs": [
    {
      "id": "m5xj3-ef4gh",
      "filePath": "C:\\dev\\myapp\\src\\auth.ts",
      "lineStart": 42,
      "lineEnd": 55,
      "quote": "const token = jwt.sign(..."
    }
  ],
  "created": 1700000000000,
  "modified": 1700000001234
}
```

- `projectPath: null` → global note, stored in `~/.claude/notes/`
- `projectPath: "C:\\dev\\..."` → project note, stored in `~/.claude/projects/{encoded}/notes/`
- `created`/`modified` are millisecond timestamps
- `fileRefs` are optional line-anchored code snippets captured from the Monaco editor

### File watcher events

- `notes-changed` — emitted when any `~/.claude/notes/*.json` changes or when any `~/.claude/projects/*/notes/*.json` changes
- Frontend invalidates the `["notes"]` React Query cache on this event
