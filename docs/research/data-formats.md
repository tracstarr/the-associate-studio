# Claude IDE Data Formats Documentation

This document comprehensively documents all data formats used by Claude Code CLI and the .claude/ folder structure. These formats are used by the IDE to read and display Claude Code sessions, teams, agents, inboxes, todos, plans, and tasks.

**Generated**: February 21, 2026
**Source**: ~/.claude/ directory analysis + Associate (Rust) + Claudeteam (Go) source code

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Team Format](#team-format)
3. [Session/Transcript Format](#sessiontranscript-format)
4. [Task Format](#task-format)
5. [Inbox Message Format](#inbox-message-format)
6. [Todo Format](#todo-format)
7. [Plans Format](#plans-format)
8. [Session Index Format](#session-index-format)
9. [File Watching & Live Updates](#file-watching--live-updates)
10. [Sending Messages to Agent Inboxes](#sending-messages-to-agent-inboxes)
11. [Session Identification](#session-identification)
12. [Gotchas & Edge Cases](#gotchas--edge-cases)

---

## Directory Structure

```
~/.claude/
├── teams/                          # Team configurations
│   ├── {team-name}/
│   │   ├── config.json            # Team metadata and members
│   │   └── inboxes/
│   │       ├── {agent-name}.json  # Agent inbox messages (array)
│   │       └── ...
│   └── ...
├── projects/                       # Session transcripts
│   ├── {encoded-project-path}/
│   │   ├── sessions-index.json    # Optional index of all sessions
│   │   ├── {session-id}.jsonl     # Session transcript (JSONL)
│   │   └── ...
│   └── ...
├── tasks/                          # Task tracking per team
│   ├── {team-id}/
│   │   ├── 1.json                 # Task #1
│   │   ├── 2.json                 # Task #2
│   │   ├── {id}.lock              # Lock file (skip during read)
│   │   └── ...
│   └── ...
├── todos/                          # Todo lists
│   ├── {uuid}-agent-{uuid}.json   # Agent todo file
│   └── ...
├── plans/                          # Stored plans (markdown)
│   ├── {random-adjective-name}.md # Plan file
│   └── ...
├── agents/                         # Agent prompt templates
│   ├── gsd-*.md                   # Get-Shit-Done agent prompts
│   └── ...
├── session-env/                    # Session environment data
├── shell-snapshots/                # Shell state snapshots
├── file-history/                   # File modification history
├── cache/                          # Cache files
└── .credentials.json               # Encrypted credentials (DO NOT READ)
```

### Project Path Encoding

Project directories are encoded to directory names by these rules:

**Rust (from path_encoding.rs):**
```
1. Replace `:\` with `--` (Windows drive letter)
2. Replace remaining `\` with `-`
3. Replace `/` with `-` (if present)

Example: C:\dev\profile-server → C--dev-profile-server
Example: C:\Users\Keith\projects\my-app → C--Users-Keith-projects-my-app
```

**Go (from claudeteam):**
```
Uses a string replacer that replaces: \ / : .
All become: -

Example: C:\dev\project → C--dev-project
```

**NOTE**: The Rust version is more precise (only replaces `:\` with `--`). The Go version replaces `:` everywhere. For IDE implementation, use the Rust approach.

---

## Team Format

**File Path**: `~/.claude/teams/{team-name}/config.json`

**Complete JSON Schema**:

```json
{
  "name": "string",                    // Team display name
  "description": "string",             // Team description
  "createdAt": 1771724359571,         // Unix timestamp (milliseconds)
  "leadAgentId": "string",             // e.g. "team-lead@claude-ide"
  "leadSessionId": "string",           // UUID of lead's session
  "members": [
    {
      "agentId": "string",             // e.g. "researcher@team-name"
      "name": "string",                // Human name: "team-lead", "researcher"
      "agentType": "string",           // "architect", "general-purpose", "Explore"
      "model": "string",               // "claude-sonnet-4-6", "claude-opus-4-6", "haiku"
      "joinedAt": 1771724359571,       // Unix timestamp (milliseconds)
      "cwd": "string",                 // Working directory: "C:\\dev\\ide"
      "tmuxPaneId": "string",          // Tmux pane ID or "in-process"
      "subscriptions": [],             // Array of subscribed topics
      "color": "string",               // UI color: "blue", "green", "yellow", "purple"
      "prompt": "string",              // Optional: agent's system prompt
      "planModeRequired": boolean,     // Whether agent requires plan approval
      "backendType": "string"          // "in-process" or other backend type
    }
  ]
}
```

**Example** (claude-ide team):
```json
{
  "name": "claude-ide",
  "description": "Design and implement a lightweight Windows IDE for agentic AI development centered on Claude Code CLI",
  "createdAt": 1771724359571,
  "leadAgentId": "team-lead@claude-ide",
  "leadSessionId": "844d56b1-c7fe-492d-87f8-ae27487faedd",
  "members": [
    {
      "agentId": "team-lead@claude-ide",
      "name": "team-lead",
      "agentType": "architect",
      "model": "claude-sonnet-4-6",
      "joinedAt": 1771724359571,
      "cwd": "C:\\dev\\ide",
      "tmuxPaneId": "",
      "subscriptions": [],
      "color": "blue"
    }
  ]
}
```

**Key Notes:**
- `agentId` format: `{agent-name}@{team-name}`
- `createdAt` and `joinedAt` are millisecond-precision Unix timestamps
- Optional fields use defaults if missing (Associate uses `#[serde(default)]`)
- Team directories can exist without config.json (UUID-based teams with only inboxes)

---

## Session/Transcript Format

### sessions-index.json

**File Path**: `~/.claude/projects/{encoded-project}/sessions-index.json`

**Optional file** that indexes all sessions for a project. If missing, the system falls back to scanning for .jsonl files.

```json
{
  "version": 1,
  "originalPath": "string",          // e.g. "C:\\dev"
  "entries": [
    {
      "sessionId": "string",          // UUID of session
      "firstPrompt": "string",        // First user prompt (truncated)
      "summary": "string",            // Optional summary
      "messageCount": 42,             // Number of messages
      "created": "2026-02-20T22:37:37.785Z",
      "modified": "2026-02-20T22:37:37.785Z",
      "gitBranch": "string",          // Current git branch
      "projectPath": "string",        // Project directory
      "isSidechain": false            // true = don't show in main list
    }
  ]
}
```

### Transcript JSONL Format

**File Path**: `~/.claude/projects/{encoded-project}/{session-id}.jsonl`

**Format**: JSON Lines (one JSON object per line)

Each line is a separate JSON object representing an event in the session. All lines share a common envelope structure:

```json
{
  "type": "string",                  // Event type: "progress", "message", "tool-use", etc.
  "sessionId": "string",             // UUID of session
  "cwd": "string",                   // Working directory: "C:\\dev"
  "gitBranch": "string",             // Git branch at time of event
  "timestamp": "2026-02-20T22:37:37.785Z",
  "version": "string",               // Claude version: "2.1.49"
  "userType": "string",              // "external" or "internal"
  "isSidechain": false,              // true = branched session
  "parentUuid": null,                // UUID of parent session if sidechain
  "parentToolUseID": "string",       // ID of parent tool use
  "toolUseID": "string",             // Unique ID for this tool use
  "uuid": "string",                  // Event UUID
  "data": {                          // Event-specific data (varies by type)
    // Structure depends on "type"
  }
}
```

**Example Event (hook_progress)**:
```json
{
  "type": "progress",
  "data": {
    "type": "hook_progress",
    "hookEvent": "SessionStart",
    "hookName": "SessionStart:startup",
    "command": "node \"C:/Users/Keith/.claude/hooks/gsd-check-update.js\""
  },
  "sessionId": "a7cd3721-30c5-4552-abfe-a5fbce223e10",
  "cwd": "C:\\dev",
  "gitBranch": "HEAD",
  "timestamp": "2026-02-20T22:37:37.785Z",
  "version": "2.1.49",
  "userType": "external",
  "isSidechain": false,
  "parentUuid": null,
  "parentToolUseID": "cf9da425-9950-4fd7-a2b7-bafbc9d00263",
  "toolUseID": "cf9da425-9950-4fd7-a2b7-bafbc9d00263",
  "uuid": "dab9321e-5344-4664-9abe-8de9b5564e6c"
}
```

**Common Event Types**:
- `progress`: Hook execution or progress updates
- `file-history-snapshot`: File modification tracking
- `message`: User or assistant messages
- `tool-use`: Tool call execution

**Scanning Logic** (from Associate):
1. Try loading `sessions-index.json` if it exists
2. If not found, scan directory for `.jsonl` files
3. Extract session metadata from first 30 lines of each JSONL
4. Sort by modified time (most recent first)

**Session ID Extraction**:
- File name: `{session-id}.jsonl`
- Session ID is the stem (filename without extension)
- Session ID is a UUID

---

## Task Format

**File Path**: `~/.claude/tasks/{team-name}/{task-id}.json`

**Complete JSON Schema**:

```json
{
  "id": "string",                    // Task ID (usually numeric: "1", "2", etc.)
  "subject": "string",               // Task title
  "description": "string",           // Detailed description
  "activeForm": "string",            // Present continuous form shown in spinner
  "status": "string",                // "pending" | "in_progress" | "completed" | "deleted"
  "owner": "string",                 // Optional: agent name who owns task
  "blocks": ["string"],              // List of task IDs this task blocks
  "blockedBy": ["string"],           // List of task IDs that block this task
  "metadata": {}                     // Arbitrary metadata object
}
```

**Example**:
```json
{
  "id": "1",
  "subject": "Understand entry point and CLI structure",
  "description": "Read cmd/claudeteam/main.go and go.mod to understand how the app is invoked, what dependencies are used, and how the CLI is structured.",
  "activeForm": "Reading entry point and CLI structure",
  "status": "pending",
  "blocks": [],
  "blockedBy": [],
  "metadata": {}
}
```

**TaskStatus Enum**:
- `"pending"`: Not started
- `"in_progress"`: Currently being worked on
- `"completed"`: Finished
- `"deleted"`: Marked for deletion (filter out when reading)

**Display Icons** (from Associate):
- pending: `[ ]`
- in_progress: `[=]`
- completed: `[X]`
- deleted: `[-]`

**File Handling**:
- Skip files with `.lock` extension (currently being written)
- Skip tasks with `status: "deleted"`
- Sort by numeric ID if possible, otherwise alphabetically

**Task Dependencies**:
- `blocks`: This task prevents other tasks from starting
- `blockedBy`: This task cannot start until dependencies complete
- Cycle detection is client responsibility

---

## Inbox Message Format

**File Path**: `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`

**Format**: JSON Array of messages

```json
[
  {
    "from": "string",                // Sender agent name
    "text": "string",                // Message text (may be JSON string)
    "timestamp": "2026-02-22T01:40:50.856Z",
    "read": false,                   // Whether message has been read
    "color": "string"                // Optional: UI color hint
  }
]
```

**Example**:
```json
[
  {
    "from": "data-format-researcher",
    "text": "{\"type\":\"task_assignment\",\"taskId\":\"8\",\"subject\":\"Document all Claude IDE data formats\",\"description\":\"...\",\"assignedBy\":\"data-format-researcher\",\"timestamp\":\"2026-02-22T01:40:50.856Z\"}",
    "timestamp": "2026-02-22T01:40:50.856Z",
    "read": false,
    "color": "green"
  }
]
```

### Structured Message Types

Messages can contain JSON in the `text` field. Common types:

**task_assignment**:
```json
{
  "type": "task_assignment",
  "taskId": "string",
  "subject": "string",
  "description": "string",
  "assignedBy": "string",
  "timestamp": "ISO8601"
}
```

**idle_notification**:
```json
{
  "type": "idle_notification",
  "from": "string" or "agentName": "string",
  "timestamp": "ISO8601"
}
```

**shutdown_request**:
```json
{
  "type": "shutdown_request",
  "requestId": "string"
}
```

**shutdown_response**:
```json
{
  "type": "shutdown_response",
  "requestId": "string",
  "approve": boolean,
  "reason": "string"
}
```

**plan_approval_request**:
```json
{
  "type": "plan_approval_request",
  "requestId": "string",
  "from": "string"
}
```

**plan_approval_response**:
```json
{
  "type": "plan_approval_response",
  "requestId": "string",
  "approve": boolean,
  "feedback": "string"
}
```

### Message Parsing (from Associate)

The Associate source includes `format_structured_message()` function that:
1. Attempts to parse `text` as JSON
2. Extracts `type` field
3. Formats human-readable summary based on type
4. Falls back to raw text if not JSON

---

## Todo Format

**File Path**: `~/.claude/todos/{uuid}-agent-{uuid}.json`

**Format**: JSON Array of todo items

```json
[
  {
    "content": "string",             // Todo text
    "status": "string",              // "pending" | "in_progress" | "completed"
    "activeForm": "string"           // Optional: action in progress
  }
]
```

**Example**:
```json
[
  {
    "content": "Implement authentication module",
    "status": "in_progress",
    "activeForm": "Implementing auth"
  },
  {
    "content": "Write tests",
    "status": "pending"
  }
]
```

**Empty Todo Files**:
- Files with empty `[]` arrays are skipped by the loader
- Filename is just a hint (UUID format), actual todo content is in the array

**Status Icons** (from Associate):
- pending: `[ ]`
- in_progress: `[=]`
- completed: `[X]`
- other: `[ ]`

---

## Plans Format

**File Path**: `~/.claude/plans/{random-name}.md`

**Format**: Markdown files with a name pattern of `{adjective}-{adjective}-{noun}.md`

**Examples**:
- `abstract-chasing-riddle.md`
- `atomic-rolling-sunset.md`
- `cached-squishing-quail.md`

**Content**: Plain markdown text, typically containing:
- Plan title (# heading)
- Context/background
- Approach/strategy
- Implementation steps
- Expected outcomes

**No Structured Format**:
- Each plan file is independent markdown
- Files are human-readable
- Content structure varies by use case
- Typically created by planning agents

**Example Content**:
```markdown
# Fix: Explore Page Search Bar

## Context
The search bar on the `/explore` hero section (`SearchHero` component) does nothing when submitted...

## Approach
Wire the hero search button to navigate to `/explore/map` with search query...

## Changes
1. `components/explore/search-hero.tsx`
   - Import `useRouter`
   - Update `handleSearch` to navigate
```

---

## Session Index Format

**File Path**: `~/.claude/projects/{encoded-project}/sessions-index.json`

**Purpose**: Provides a quick index of all sessions for a project without scanning individual JSONL files.

**Schema** (detailed):
```json
{
  "version": 1,
  "originalPath": "C:\\dev",
  "entries": [
    {
      "sessionId": "a7cd3721-30c5-4552-abfe-a5fbce223e10",
      "firstPrompt": "Can you help me with...",  // Truncated (60 chars)
      "summary": "Researched Tauri...",          // Optional
      "messageCount": 42,
      "created": "2026-01-24T12:13:56.000Z",
      "modified": "2026-02-20T22:37:37.785Z",
      "gitBranch": "feature/auth",
      "projectPath": "C:\\dev",
      "isSidechain": false                       // Skip if true
    }
  ]
}
```

**Display Priority** (from Associate):
1. If `summary` exists and non-empty: use it
2. Else if `firstPrompt` exists: use truncated version (60 chars, add `...`)
3. Else: use first 8 chars of `sessionId`

**Sorting**: By `modified` time, most recent first

**Sidechains**: Sessions with `isSidechain: true` are alternate branches and should be filtered out from main display

---

## File Watching & Live Updates

### What to Watch

The IDE should implement file watching for these paths:

1. **Teams**: `~/.claude/teams/*/config.json` and `~/.claude/teams/*/inboxes/*.json`
   - Update team list when config changes
   - Update inbox messages when inbox files change

2. **Tasks**: `~/.claude/tasks/{team-name}/*.json` (skip `.lock` files)
   - Update task list when files change
   - Skip deleted tasks

3. **Sessions**: `~/.claude/projects/{encoded-project}/*.jsonl`
   - Append new events to session transcript
   - Update modified time

4. **Session Index**: `~/.claude/projects/{encoded-project}/sessions-index.json`
   - Refresh session list

5. **Todos**: `~/.claude/todos/*.json`
   - Update todo display

6. **Plans**: `~/.claude/plans/*.md`
   - Add/update/remove plans

### Implementation Strategy

**Watch Root Directories**:
- `~/.claude/teams/` (recursive)
- `~/.claude/tasks/` (recursive)
- `~/.claude/projects/` (recursive)
- `~/.claude/todos/`
- `~/.claude/plans/`

**Debouncing**:
- Use 500ms debounce for file changes
- Prevent rapid re-reads during write operations

**Change Detection**:
1. Monitor file creation, modification, deletion
2. On change, re-read the file (if exists)
3. Update in-memory data structure
4. Notify UI subscribers

**Windows Considerations** (from Associate):
- Use `notify` crate for cross-platform file watching
- Handle path separators (\ vs /)
- ConPTY process management for terminal integration

---

## Sending Messages to Agent Inboxes

### Writing to Agent Inbox

To send a message to an agent:

1. **File Path**: `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`

2. **Operation**:
   - Read existing array
   - Append new message object
   - Write back (entire array)
   - File will be watched and picked up by agent

3. **Message Structure**:
```json
{
  "from": "sender-agent-name",
  "text": "message text or JSON string",
  "timestamp": "ISO8601 timestamp",
  "read": false,
  "color": "optional-color"
}
```

4. **Structured Messages**:
   - Wrap JSON objects as JSON strings in the `text` field
   - Agent will parse `text` field if it starts with `{`
   - Example: `"text": "{\"type\":\"task_assignment\",\"taskId\":\"1\",...}"`

5. **Lock File Pattern**:
   - While writing, create `{agent-name}.json.lock`
   - Write data to lock file
   - Atomic rename lock file to actual file

### Example: Send Task Assignment

```bash
# Read existing inbox
cat ~/.claude/teams/my-team/inboxes/researcher.json

# Create new message
{
  "from": "team-lead",
  "text": "{\"type\":\"task_assignment\",\"taskId\":\"5\",\"subject\":\"Research API\",\"description\":\"...\"}",
  "timestamp": "2026-02-22T14:30:00.000Z",
  "read": false
}

# Append and write back entire array
```

---

## Session Identification

### How Project Directory Maps to Session

**Forward Mapping** (path → session directory):

```rust
fn encode_project_path(path: &Path) -> String {
    let s = path.to_string_lossy().to_string();
    let s = s.replace('/', "\\");           // Normalize slashes
    let s = s.replace(":\\", "--");         // Drive letter
    s.replace('\\', "-")                    // Path separators
}
```

**Examples**:
- `C:\dev\ide` → `C--dev-ide`
- `C:\Users\Keith\projects\my-app` → `C--Users-Keith-projects-my-app`
- `C:\dev\profile-server\.worktrees\aero-planning` → `C--dev-profile-server-.worktrees-aero-planning`

**Reverse Mapping** (session directory → path):

Not directly reversible due to ambiguity. However, the `sessions-index.json` stores `originalPath`:

```json
{
  "originalPath": "C:\\dev"
}
```

This allows reconstructing the original path.

### Session Lifecycle

1. **Session Start**:
   - User runs `claude` in project directory: `cd C:\dev\ide && claude`
   - Project path is encoded: `C--dev-ide`
   - Directory created: `~/.claude/projects/C--dev-ide/`
   - Session JSONL file created: `{session-uuid}.jsonl`

2. **Session Index**:
   - `sessions-index.json` optionally maintains quick index
   - File can be read to get all sessions without scanning JSONL files

3. **Finding Active Session**:
   - Scan `~/.claude/projects/{encoded}/` for `.jsonl` files
   - Find most recently modified `.jsonl`
   - Use its UUID as active session

---

## Gotchas & Edge Cases

### 1. Path Encoding Differences

**Issue**: Different systems encode paths differently.

**Rust (Associate)**: `C:\dev\project` → `C--dev-project` (precise: only `:\` becomes `--`)

**Go (Claudeteam)**: `C:\dev\project` → `C--dev-project` (replaces `:` everywhere)

**Resolution**: For IDE, use Rust approach (more conservative). When looking up projects, try exact match first, then prefix matching.

### 2. Optional Fields

**Issue**: Many JSON fields are optional and may be missing or null.

**Use `#[serde(default)]` in Rust:**
```rust
#[serde(default)]
pub field: Option<String>,
```

**Always provide defaults** in deserialization.

### 3. Lock Files During Write

**Issue**: Files may be partially written during updates.

**Pattern**: Skip `.lock` files during task reads:
```rust
if path.file_name().contains(".lock") {
    continue;  // Skip
}
```

### 4. Deleted Tasks Still in Filesystem

**Issue**: Tasks with `status: "deleted"` are not removed, just marked.

**Solution**: Filter out during read:
```rust
if task.status == TaskStatus::Deleted {
    continue;  // Skip
}
```

### 5. Sidechains (Alternate Session Branches)

**Issue**: `isSidechain: true` sessions are branches, should be hidden.

**Solution**: Filter during session list read:
```rust
.filter(|e| e.is_sidechain != Some(true))
```

### 6. Empty Todo Arrays

**Issue**: Todo files with `[]` are skipped to avoid clutter.

**Solution**: Only add TodoFile if `items.len() > 0`.

### 7. Inbox Message Order

**Issue**: Inbox is an array; order matters for display.

**Convention**: Sort by timestamp descending (most recent first).

```rust
messages.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
```

### 8. Team Matching by CWD

**Issue**: Multiple teams may have members in the same project directory.

**Strategy** (from Associate):
1. Filter teams where member.cwd matches or is parent of project_cwd
2. Normalize paths (lowercase, backslash separators)
3. Check exact match OR starts_with pattern

**Example**:
```rust
member_path == cwd_normalized ||
member_path.starts_with(&format!("{}\\", cwd_normalized))
```

### 9. Session ID Format

**Issue**: Session IDs are UUIDs, not sequential.

**Format**: Standard UUID (36 chars with hyphens): `a7cd3721-30c5-4552-abfe-a5fbce223e10`

**Display**: Usually show first 8 chars when truncating: `a7cd3721`

### 10. Timestamp Precision

**Issue**: Timestamps use different precisions.

**Millisecond timestamps** (from team config):
```
"createdAt": 1771724359571     // milliseconds since epoch
```

**ISO8601 timestamps** (from sessions/inbox):
```
"timestamp": "2026-02-20T22:37:37.785Z"
```

**Conversion**:
- Milliseconds → ISO8601: `new Date(millis).toISOString()`
- ISO8601 → Milliseconds: `new Date(iso).getTime()`

### 11. UUID-based Teams Without Config

**Issue**: Some team directories exist with only inboxes, no config.json.

**Pattern**: Teams can be identified by presence of `inboxes/` directory.

**Handling**:
```rust
if !config_path.exists() {
    let inboxes_dir = path.join("inboxes");
    if inboxes_dir.exists() {
        // This is a valid team (UUID-based, no config)
        teams.push(Team {
            dir_name,
            config: TeamConfig::default(),  // Empty config
        });
    }
}
```

### 12. JSONL Large File Handling

**Issue**: Session JSONL files can grow very large (thousands of lines).

**Strategy**:
- Don't load entire file into memory
- Stream read first 30 lines for metadata
- For full transcript display, implement pagination
- Cache recently-read sections

### 13. Git Branch Tracking

**Issue**: `gitBranch` field may be missing or contain "HEAD".

**Handling**:
```rust
pub fn branch(&self) -> &str {
    self.git_branch.as_deref().unwrap_or("")
}
```

Display as empty string if missing or "HEAD".

### 14. Concurrent File Updates

**Issue**: File might be updated while reading.

**Strategy**:
- Catch read errors (file might be deleted)
- Retry with exponential backoff for transient errors
- Use file locks where supported

### 15. Cross-platform Path Issues

**Windows Specific**:
- Always normalize to backslashes in stored paths
- Use `PathBuf` for path operations
- Handle UNC paths (`\\server\share`)
- ConPTY for pseudo-terminal support

---

## Implementation Checklist for Rust Backend

Based on this documentation, the Rust backend should implement:

**Core Data Structures**:
- [ ] `Team` and `TeamConfig` structs (mirror Associate models)
- [ ] `SessionEntry` and `SessionIndex` structs
- [ ] `Task` and `TaskStatus` structs
- [ ] `InboxMessage` struct
- [ ] `TodoItem` and `TodoFile` structs
- [ ] Path encoding/decoding functions

**Loading Functions**:
- [ ] `load_teams(claude_home, project_cwd)` - load teams
- [ ] `load_tasks(claude_home, team_name)` - load tasks
- [ ] `load_sessions(project_dir)` - load sessions with fallback
- [ ] `load_inbox(claude_home, team_name, agent_name)` - load inbox
- [ ] `load_todos(claude_home)` - load all todos
- [ ] `scan_jsonl_files(project_dir)` - scan session files

**File Watching**:
- [ ] Implement recursive directory watchers using `notify` crate
- [ ] Debounce file change events (500ms)
- [ ] Trigger appropriate callbacks on changes
- [ ] Handle Windows ConPTY process management

**Message Sending**:
- [ ] Function to append message to inbox
- [ ] Atomic write with lock file pattern
- [ ] JSON serialization of structured messages

**Path Operations**:
- [ ] `encode_project_path(path)` - encode Windows paths
- [ ] Fallback decoding using sessions-index
- [ ] Normalize path separators

---

## References

### Source Files Analyzed

**Associate (Rust)**:
- `src/data/sessions.rs` - Session loading with JSONL fallback
- `src/data/teams.rs` - Team loading with CWD filtering
- `src/data/inboxes.rs` - Inbox message loading
- `src/data/todos.rs` - Todo file loading
- `src/data/tasks.rs` - Task loading with status filtering
- `src/data/path_encoding.rs` - Windows path encoding
- `src/model/session.rs` - Session data models
- `src/model/team.rs` - Team data models
- `src/model/task.rs` - Task data models
- `src/model/inbox.rs` - Inbox message formatting
- `src/model/todo.rs` - Todo item models

**Claudeteam (Go)**:
- `internal/team/types.go` - Go data type definitions
- `internal/session/finder.go` - Session directory encoding/finding

### Actual ~/.claude/ Files Examined

- `~/.claude/teams/claude-ide/config.json` - Team configuration example
- `~/.claude/teams/claude-ide/inboxes/data-format-researcher.json` - Inbox example
- `~/.claude/projects/C--dev/sessions-index.json` - Session index example
- `~/.claude/projects/C--dev/a7cd3721-30c5-4552-abfe-a5fbce223e10.jsonl` - Session transcript example
- `~/.claude/tasks/*/` - Task files
- `~/.claude/todos/` - Todo files
- `~/.claude/plans/` - Plan files

---

## Summary

The Claude IDE data format ecosystem consists of:

1. **Persistent State**: Teams (config.json), Tasks (per-team JSON), Todos, Plans
2. **Session Transcripts**: JSONL format with optional index
3. **Communication**: File-based inbox with structured JSON messages
4. **Identification**: Windows path encoding with project directory mapping
5. **File Watching**: Recursive monitoring for real-time updates

All formats are designed for file-system based persistence with minimal external dependencies, enabling offline-first IDE functionality. The Rust backend should mirror the parsing logic from Associate for consistency and compatibility.
