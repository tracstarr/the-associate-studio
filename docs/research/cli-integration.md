# Claude Code CLI Integration Guide

> Comprehensive reference for integrating Claude Code CLI into the IDE backend.
> Research by cli-integration-researcher agent, Feb 2026.

---

## Table of Contents

1. [CLI Command Reference](#1-cli-command-reference)
2. [Session Architecture](#2-session-architecture)
3. [Path Encoding](#3-path-encoding)
4. [File System Layout](#4-file-system-layout)
5. [Transcript Format](#5-transcript-format)
6. [Team Integration](#6-team-integration)
7. [Agent Inbox Protocol](#7-agent-inbox-protocol)
8. [Task System](#8-task-system)
9. [Subagent Architecture](#9-subagent-architecture)
10. [Hooks System](#10-hooks-system)
11. [Settings Reference](#11-settings-reference)
12. [Git Integration](#12-git-integration)
13. [CLI Spawning Strategy](#13-cli-spawning-strategy)
14. [File Watcher Patterns](#14-file-watcher-patterns)
15. [IPC Patterns](#15-ipc-patterns)
16. [Windows-Specific Considerations](#16-windows-specific-considerations)

---

## 1. CLI Command Reference

### Primary Commands

| Command | Description |
|---------|-------------|
| `claude` | Start interactive REPL in current directory |
| `claude "query"` | Start REPL with initial prompt |
| `claude -p "query"` | SDK/headless mode - query then exit |
| `cat file \| claude -p "query"` | Pipe content into query |
| `claude -c` | Continue most recent conversation in current directory |
| `claude -c -p "query"` | Continue via SDK |
| `claude -r "<session>" "query"` | Resume session by ID or name |
| `claude update` | Update to latest version |
| `claude agents` | List all configured subagents |
| `claude mcp` | Configure MCP servers |

### Complete Flag Reference

#### Session Management
| Flag | Description |
|------|-------------|
| `--continue`, `-c` | Load most recent conversation in current directory |
| `--resume`, `-r` | Resume session by ID or name, or show picker |
| `--session-id` | Use specific session UUID |
| `--fork-session` | When resuming, create new session ID (use with --resume/--continue) |
| `--from-pr` | Resume sessions linked to a GitHub PR number |
| `--no-session-persistence` | Don't save session to disk (print mode only) |

#### Execution Mode
| Flag | Description |
|------|-------------|
| `--print`, `-p` | Non-interactive mode - print response and exit |
| `--output-format` | Output format: `text`, `json`, `stream-json` |
| `--input-format` | Input format: `text`, `stream-json` |
| `--include-partial-messages` | Include partial streaming events (requires -p + stream-json) |
| `--json-schema` | Get validated JSON output matching schema (print mode) |
| `--max-turns` | Limit agentic turns (print mode) |
| `--max-budget-usd` | Maximum dollar spend before stopping (print mode) |
| `--fallback-model` | Auto-fallback model when default overloaded (print mode) |

#### Model & Prompt
| Flag | Description |
|------|-------------|
| `--model` | Model alias (`sonnet`, `opus`, `haiku`) or full name |
| `--system-prompt` | Replace entire system prompt |
| `--system-prompt-file` | Replace system prompt from file (print mode) |
| `--append-system-prompt` | Append to default system prompt |
| `--append-system-prompt-file` | Append file contents to prompt (print mode) |

#### Permissions
| Flag | Description |
|------|-------------|
| `--permission-mode` | Start in mode: `default`, `plan`, `acceptEdits`, `dontAsk`, `bypassPermissions` |
| `--dangerously-skip-permissions` | Skip all permission prompts |
| `--allow-dangerously-skip-permissions` | Enable bypass as option without activating |
| `--permission-prompt-tool` | MCP tool for permission prompts in non-interactive mode |

#### Tools
| Flag | Description |
|------|-------------|
| `--tools` | Restrict available tools: `""` for none, `"default"` for all, or comma-separated |
| `--allowedTools` | Tools that execute without permission prompt |
| `--disallowedTools` | Tools removed from model context |

#### Agent & Team
| Flag | Description |
|------|-------------|
| `--agent` | Specify agent for session |
| `--agents` | Define custom subagents via JSON |
| `--teammate-mode` | Team display: `auto`, `in-process`, `tmux` |

#### Configuration
| Flag | Description |
|------|-------------|
| `--add-dir` | Add additional working directories |
| `--mcp-config` | Load MCP servers from JSON files |
| `--strict-mcp-config` | Only use MCP servers from --mcp-config |
| `--settings` | Path to additional settings JSON |
| `--setting-sources` | Comma-separated sources: `user`, `project`, `local` |
| `--plugin-dir` | Load plugins from directories |
| `--betas` | Beta headers for API requests |

#### Features
| Flag | Description |
|------|-------------|
| `--chrome` / `--no-chrome` | Enable/disable Chrome browser integration |
| `--ide` | Auto-connect to IDE on startup |
| `--worktree`, `-w` | Start in isolated git worktree |
| `--remote` | Create web session on claude.ai |
| `--teleport` | Resume web session locally |
| `--disable-slash-commands` | Disable all skills/slash commands |

#### Debug & Info
| Flag | Description |
|------|-------------|
| `--debug` | Enable debug mode (optional category filter) |
| `--verbose` | Verbose logging |
| `--version`, `-v` | Output version number |
| `--init` | Run initialization hooks + start interactive |
| `--init-only` | Run initialization hooks and exit |
| `--maintenance` | Run maintenance hooks and exit |

---

## 2. Session Architecture

### Session Lifecycle

```
Start Session
    │
    ├── claude                    → New interactive session
    ├── claude -p "query"         → Headless/SDK session
    ├── claude -c                 → Continue most recent session
    └── claude -r <id>            → Resume specific session
         │
         ▼
    Session Running (UUID assigned)
    ├── Transcript written to ~/.claude/projects/<encoded-path>/<uuid>.jsonl
    ├── Sessions index updated: ~/.claude/projects/<encoded-path>/sessions-index.json
    ├── Hooks fire at lifecycle points
    └── User interacts / tools execute
         │
         ▼
    Session End
    ├── SessionEnd hook fires
    ├── Transcript preserved on disk
    └── Session can be resumed later
```

### Session Storage

Sessions are stored under `~/.claude/projects/<encoded-project-path>/`:

```
~/.claude/projects/C--dev-myproject/
├── sessions-index.json                    # Index of all sessions
├── <uuid>.jsonl                           # Transcript for session
├── <uuid>/                                # Session subdirectory
│   └── subagents/                         # Subagent transcripts
│       ├── agent-<id>.jsonl
│       └── agent-<id>.jsonl
└── memory/                                # Auto-memory directory
    └── MEMORY.md
```

### sessions-index.json Format

```json
{
  "version": 1,
  "entries": [
    {
      "sessionId": "844d56b1-c7fe-492d-87f8-ae27487faedd",
      "firstPrompt": "Create a team to design...",
      "summary": "IDE design and implementation",
      "messageCount": 42,
      "created": "2026-02-22T01:31:44.792Z",
      "modified": "2026-02-22T02:15:33.100Z",
      "gitBranch": "main",
      "projectPath": "C:\\dev\\ide",
      "isSidechain": false
    }
  ]
}
```

### Fallback Session Discovery

If `sessions-index.json` doesn't exist, scan for `.jsonl` files and extract metadata from the first ~30 lines:
- `sessionId` from envelope
- `gitBranch` from envelope
- `cwd` from envelope
- `timestamp` from envelope
- First user prompt from `type: "user"` lines
- Message count from user/assistant lines

---

## 3. Path Encoding

Project paths are encoded to create directory names under `~/.claude/projects/`:

### Encoding Rules (Windows)
1. Replace `:\` with `--`
2. Replace remaining `\` and `/` with `-`

### Examples
| Absolute Path | Encoded Name |
|---------------|-------------|
| `C:\dev\profile-server` | `C--dev-profile-server` |
| `C:\dev\ide` | `C--dev-ide` |
| `C:\Users\Keith\projects\my-app` | `C--Users-Keith-projects-my-app` |
| `C:\dev\profile-server\.worktrees\aero-planning` | `C--dev-profile-server-.worktrees-aero-planning` |

### Implementation (Rust)
```rust
pub fn encode_project_path(path: &Path) -> String {
    let s = path.to_string_lossy().to_string();
    let s = s.replace('/', "\\");      // Normalize to backslash
    let s = s.replace(":\\", "--");     // Drive letter encoding
    s.replace('\\', "-")               // Remaining separators
}
```

---

## 4. File System Layout

### Complete ~/.claude/ Structure

```
~/.claude/
├── settings.json              # User-level settings
├── CLAUDE.md                  # User-level memory/instructions
├── .claude.json               # OAuth, MCP configs, per-project state
├── agents/                    # User-level custom subagents
│   └── *.md                   # Subagent definition files
├── skills/                    # User-level custom skills
├── plugins/                   # Installed plugins
├── projects/                  # Per-project session storage
│   └── <encoded-path>/
│       ├── sessions-index.json
│       ├── <uuid>.jsonl       # Session transcripts
│       ├── <uuid>/
│       │   └── subagents/
│       │       └── agent-<id>.jsonl
│       └── memory/
│           └── MEMORY.md
├── teams/                     # Team configurations
│   └── <team-name>/
│       ├── config.json        # Team config with members
│       └── inboxes/
│           └── <agent-name>.json
├── tasks/                     # Task storage (per team or shared)
│   └── <team-name-or-uuid>/
│       ├── 1.json
│       ├── 2.json
│       └── ...
├── plans/                     # Plan storage
├── todos/                     # Todo storage
├── hooks/                     # Custom hook scripts
├── commands/                  # Custom slash commands
├── history.jsonl              # Command history
├── cache/                     # Various caches
├── telemetry/                 # Telemetry data
├── chrome/                    # Chrome integration data
├── ide/                       # IDE integration data
├── file-history/              # File version history
├── backups/                   # Settings backups
├── session-env/               # Session environment files
└── statsig/                   # Feature flags
```

---

## 5. Transcript Format

### JSONL Envelope Structure

Each line in a `.jsonl` transcript is a JSON object with these common fields:

```json
{
  "type": "user|assistant|system|progress|file-history-snapshot",
  "timestamp": "2026-02-22T01:31:44.792Z",
  "uuid": "fa32822a-6fc5-4056-8341-feeb0d90c8d4",
  "parentUuid": "5df3d76c-dcc5-47ed-83db-74a07bfe2d58",
  "sessionId": "844d56b1-c7fe-492d-87f8-ae27487faedd",
  "cwd": "C:\\dev\\ide",
  "gitBranch": "HEAD",
  "version": "2.1.50",
  "isSidechain": false,
  "userType": "external"
}
```

### Line Types

#### User Message
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "Create a team to design the IDE"
  },
  "permissionMode": "bypassPermissions",
  "todos": []
}
```

#### Assistant Message
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-sonnet-4-6",
    "id": "msg_01EHxxk2XR3z6KAP3wcHwRma",
    "role": "assistant",
    "content": [
      {"type": "text", "text": "I'll analyze..."},
      {
        "type": "tool_use",
        "id": "toolu_019K3GSDYgJeC6dB4ML5Jtcb",
        "name": "Read",
        "input": {"file_path": "C:\\dev\\ide\\README.md"}
      }
    ],
    "stop_reason": "end_turn|tool_use|max_tokens",
    "usage": {
      "input_tokens": 3,
      "output_tokens": 150,
      "cache_creation_input_tokens": 38867,
      "cache_read_input_tokens": 0
    }
  },
  "requestId": "req_011CYNF7CayKpEKj554AnYgD"
}
```

Content blocks within assistant messages:

| Block Type | Fields |
|-----------|--------|
| `text` | `text: string` |
| `tool_use` | `id, name, input` |
| `tool_result` | `content: string \| array` |
| `thinking` | `thinking: string, signature: string` |

#### Progress Event
```json
{
  "type": "progress",
  "data": {
    "type": "hook_progress",
    "hookEvent": "SessionStart",
    "hookName": "SessionStart:startup",
    "command": "node \"C:/Users/Keith/.claude/hooks/gsd-check-update.js\""
  }
}
```

#### System Message
```json
{
  "type": "system",
  "subtype": "compact_boundary",
  "compactMetadata": {
    "trigger": "auto",
    "preTokens": 167189
  }
}
```

### Incremental Transcript Reading

The associate project implements efficient incremental reading:

1. **Initial load**: Read last N lines from end of file
2. **Incremental**: Track file offset, seek to last position, read new lines only
3. **Truncation detection**: If file size < last offset, file was rotated - do full reload
4. **Memory cap**: Cap at 5000 items, drain oldest when exceeded

```rust
// Key pattern: seek-based incremental read
let mut reader = BufReader::new(file);
reader.seek(SeekFrom::Start(self.last_offset))?;
// Read new lines...
self.last_offset = file_len;
```

---

## 6. Team Integration

### Team Config Format

Teams are stored at `~/.claude/teams/<team-name>/config.json`:

```json
{
  "name": "claude-ide",
  "description": "Design and implement a lightweight Windows IDE",
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
      "tmuxPaneId": "",
      "cwd": "C:\\dev\\ide",
      "subscriptions": [],
      "color": "blue",
      "planModeRequired": false,
      "backendType": "in-process",
      "prompt": "..."
    }
  ]
}
```

### TeamMember Fields

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Unique ID: `<name>@<team-name>` |
| `name` | string | Display name |
| `agentType` | string | `architect`, `general-purpose`, `Explore`, etc. |
| `model` | string | Model name |
| `cwd` | string | Working directory |
| `color` | string | Display color |
| `joinedAt` | number | Unix timestamp (ms) |
| `tmuxPaneId` | string | tmux pane or `"in-process"` |
| `backendType` | string | `"in-process"` or tmux |
| `prompt` | string | System prompt for the agent |
| `planModeRequired` | bool | Whether plan approval needed |
| `subscriptions` | string[] | Event subscriptions |

### Team Discovery

To find teams for a specific project:
1. Scan `~/.claude/teams/` directories
2. Read `config.json` from each
3. Match members' `cwd` against project path (normalize slashes, case-insensitive)
4. If no CWD match, return all teams as fallback

### Real-Time Team Monitoring

Watch these paths for changes:
- `~/.claude/teams/<team-name>/config.json` - Member joins/leaves, status changes
- `~/.claude/teams/<team-name>/inboxes/*.json` - New messages
- `~/.claude/tasks/<team-name>/*.json` - Task state changes

---

## 7. Agent Inbox Protocol

### Inbox Location

```
~/.claude/teams/<team-name>/inboxes/<agent-name>.json
```

Each agent has one inbox file per team.

### Inbox Message Format

The inbox file is a JSON array of messages:

```json
[
  {
    "from": "team-lead",
    "text": "{\"type\":\"message\",\"content\":\"Please review the auth module\",\"summary\":\"Review auth module\"}",
    "timestamp": "2026-02-22T01:41:05.284Z",
    "color": "blue",
    "read": false
  }
]
```

### Message Types (JSON-encoded in `text` field)

| Type | Description |
|------|-------------|
| `message` | Direct message between agents |
| `task_assignment` | Task assigned to agent (fields: `taskId`, `subject`, `description`, `assignedBy`) |
| `idle_notification` | Agent went idle (field: `from` or `agentName`) |
| `shutdown_request` | Request to shut down |
| `shutdown_approved` | Shutdown confirmed |
| `plan_approval_request` | Agent requesting plan approval |
| `plan_approval_response` | Leader's plan decision (fields: `approve`, `content`) |
| `task_completed` | Task completion notification (field: `taskId`) |

### Sending Messages to an Agent

To send a message to an agent's inbox programmatically:

1. Read the current inbox file (or create empty array)
2. Append a new message object
3. Write the updated array back atomically

```json
{
  "from": "ide-user",
  "text": "{\"type\":\"message\",\"content\":\"Your message here\",\"summary\":\"Brief summary\"}",
  "timestamp": "2026-02-22T03:00:00.000Z",
  "color": "white",
  "read": false
}
```

**Important considerations:**
- Use atomic file writes (write to temp, rename) to avoid corruption
- The agent's file watcher will detect the change
- Messages are read by the agent on its next turn
- File locking should be used if multiple writers are possible

---

## 8. Task System

### Task Storage

Tasks are individual JSON files at:
```
~/.claude/tasks/<team-name>/<id>.json
```

### Task Format

```json
{
  "id": "4",
  "subject": "Research Claude Code CLI documentation",
  "description": "Detailed description...",
  "activeForm": "Researching CLI documentation",
  "status": "in_progress",
  "owner": "cli-integration-researcher",
  "blocks": [],
  "blockedBy": [],
  "metadata": {}
}
```

### Task Status Values

| Status | Description |
|--------|-------------|
| `pending` | Not yet started |
| `in_progress` | Currently being worked on |
| `completed` | Finished |
| `deleted` | Removed (filtered out when loading) |

### Task Dependencies

- `blocks`: Array of task IDs this task blocks (downstream)
- `blockedBy`: Array of task IDs that must complete before this one can start
- Tasks with unresolved `blockedBy` cannot be claimed
- When a blocking task completes, dependent tasks automatically unblock

### Task File Locking

Task claiming uses file-based locking to prevent race conditions. Lock files appear as `<id>.json.lock` and should be skipped when scanning.

### Loading Tasks

```rust
// Pattern from associate
let tasks_dir = claude_home.join("tasks").join(team_name);
// Read each .json file (skip .lock files)
// Parse Task struct
// Filter out status == Deleted
// Sort by numeric ID
```

---

## 9. Subagent Architecture

### Subagent Types

| Type | Model | Tools | Purpose |
|------|-------|-------|---------|
| `Explore` | Haiku (fast) | Read-only | Codebase search/analysis |
| `Plan` | Inherited | Read-only | Planning research |
| `general-purpose` | Inherited | All | Complex multi-step tasks |
| `Bash` | Inherited | Bash | Terminal commands |
| Custom | Configurable | Configurable | Specialized tasks |

### Subagent Transcript Storage

```
~/.claude/projects/<encoded-path>/<session-id>/subagents/agent-<agent-id>.jsonl
```

Agent IDs are short hex strings (e.g., `a5c425e`). Filenames follow pattern `agent-<id>.jsonl`.

### Custom Subagent Definition (Markdown + YAML frontmatter)

```markdown
---
name: code-reviewer
description: Reviews code for quality
tools: Read, Grep, Glob, Bash
model: sonnet
permissionMode: default
maxTurns: 50
memory: user
isolation: worktree
background: false
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./validate.sh"
skills:
  - api-conventions
mcpServers:
  - slack
---

You are a code reviewer. Analyze code and provide feedback.
```

### Subagent Locations

| Location | Scope | Priority |
|----------|-------|----------|
| `--agents` CLI flag | Session only | 1 (highest) |
| `.claude/agents/` | Project | 2 |
| `~/.claude/agents/` | User | 3 |
| Plugin `agents/` | Plugin | 4 (lowest) |

---

## 10. Hooks System

### Hook Events (Lifecycle Order)

| Event | When | Can Block? | Matcher |
|-------|------|-----------|---------|
| `SessionStart` | Session begins/resumes | No | `startup`, `resume`, `clear`, `compact` |
| `UserPromptSubmit` | User submits prompt | Yes | None |
| `PreToolUse` | Before tool executes | Yes (allow/deny/ask) | Tool name |
| `PermissionRequest` | Permission dialog shown | Yes (allow/deny) | Tool name |
| `PostToolUse` | After tool succeeds | No (feedback only) | Tool name |
| `PostToolUseFailure` | After tool fails | No | Tool name |
| `Notification` | Notification sent | No | Notification type |
| `SubagentStart` | Subagent spawned | No | Agent type |
| `SubagentStop` | Subagent finishes | Yes | Agent type |
| `Stop` | Claude finishes responding | Yes | None |
| `TeammateIdle` | Agent team member idle | Yes (exit code 2) | None |
| `TaskCompleted` | Task marked complete | Yes (exit code 2) | None |
| `ConfigChange` | Config file changes | Yes | Config source |
| `WorktreeCreate` | Worktree creation | Yes | None |
| `WorktreeRemove` | Worktree removal | No | None |
| `PreCompact` | Before compaction | No | `manual`, `auto` |
| `SessionEnd` | Session ends | No | Exit reason |

### Hook Configuration Format

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/script.sh",
            "timeout": 600,
            "async": false,
            "statusMessage": "Running linter..."
          }
        ]
      }
    ]
  }
}
```

### Hook Types

| Type | Description |
|------|-------------|
| `command` | Shell command (receives JSON on stdin) |
| `prompt` | Single LLM evaluation call |
| `agent` | Multi-turn subagent with tool access |

### Hook Input (Common Fields via stdin)

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/dir",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "npm test"}
}
```

### Hook Exit Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success - parse stdout for JSON |
| 2 | Block/deny - stderr fed back to Claude |
| Other | Non-blocking error - logged only |

### IDE-Relevant Hooks

For the IDE, the most useful hooks for monitoring are:
- **SessionStart**: Detect when a session begins (inject context)
- **PostToolUse**: Monitor file edits, bash commands
- **Stop**: Know when Claude finishes a turn
- **Notification**: Detect permission prompts, idle state
- **TeammateIdle**: Know when agents finish
- **TaskCompleted**: Track task progress

### Environment Variables in Hooks

- `$CLAUDE_PROJECT_DIR` - Project root directory
- `$CLAUDE_ENV_FILE` - Path to write persistent env vars (SessionStart only)
- `$CLAUDE_CODE_REMOTE` - "true" in remote environments

---

## 11. Settings Reference

### Settings Hierarchy (Highest to Lowest Priority)

1. **Managed** - System-wide (`C:\Program Files\ClaudeCode\`)
2. **Command-line** - CLI flags
3. **Local project** - `.claude/settings.local.json`
4. **Shared project** - `.claude/settings.json`
5. **User** - `~/.claude/settings.json`

### Key Settings for IDE Integration

```json
{
  "model": "claude-sonnet-4-6",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": ["Bash(npm run *)"],
    "deny": ["Bash(curl *)"],
    "defaultMode": "acceptEdits"
  },
  "hooks": { },
  "teammateMode": "in-process",
  "cleanupPeriodDays": 30,
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable agent teams |
| `CLAUDE_CODE_TEAM_NAME` | Current team name (set on members) |
| `ANTHROPIC_MODEL` | Model override |
| `CLAUDE_CODE_SHELL` | Override shell detection |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | Return to original dir after commands |
| `CLAUDE_CODE_TASK_LIST_ID` | Share task list across sessions |
| `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY` | Exit delay after idle (ms) |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Auto-compaction trigger (1-100) |

---

## 12. Git Integration

### Git Status Commands

The associate project uses these git commands:

```bash
# Status (porcelain for machine parsing)
git status --porcelain

# Staged diff
git diff --cached -- <file>

# Unstaged diff
git diff -- <file>

# Current branch
git rev-parse --abbrev-ref HEAD

# Remote URL (for GitHub repo detection)
git remote get-url origin
```

### Git Status Parsing

Porcelain format: `XY filename`
- X = index (staging area) status
- Y = worktree status

| Char | Meaning |
|------|---------|
| `?` | Untracked |
| `M` | Modified |
| `A` | Added |
| `D` | Deleted |
| `R` | Renamed |
| `C` | Copied |
| ` ` | Unmodified |

### Context-Aware Git

When the user selects a different Claude session:
1. Read the session's `cwd` from the transcript envelope
2. Use that path as the git working directory
3. Run `git status --porcelain` in that directory
4. Display status + diff for the session's project

### Diff Display

Three categories:
1. **Staged** - `git diff --cached`
2. **Unstaged** - `git diff`
3. **Untracked** - Read file content directly (with size limit 1MB, binary detection)

Parse diff output line-by-line:
- Lines starting with `diff `, `index `, `--- `, `+++ ` = Header
- Lines starting with `@@` = Hunk header
- Lines starting with `+` = Addition
- Lines starting with `-` = Deletion
- Other lines = Context

### GitHub Repo Detection

Walk up from CWD looking for `.git` directory, then parse remote URL:
- SSH: `git@github.com:owner/repo.git` -> `owner/repo`
- HTTPS: `https://github.com/owner/repo.git` -> `owner/repo`

---

## 13. CLI Spawning Strategy

### For the IDE: Spawning Claude Sessions

#### Interactive Sessions (Terminal tab)

The IDE should spawn Claude as a PTY process:

```
claude [--add-dir <extra-dirs>] [--model <model>]
```

Set working directory to the project path. The session will automatically:
- Create/use project directory under `~/.claude/projects/<encoded-path>/`
- Write transcript to `.jsonl` file
- Load CLAUDE.md from project
- Load project settings

#### Headless Sessions (Background agents)

For programmatic/autonomous work:

```
claude -p "<prompt>" --dangerously-skip-permissions --output-format stream-json --verbose
```

This produces streaming JSON output on stdout that can be parsed in real-time.

#### Resuming Sessions

```
claude -c                    # Most recent in current dir
claude -r <session-id>       # Specific session by UUID
claude -r <session-name>     # By session name
```

### PTY Requirements on Windows

Windows uses **ConPTY** (Console Pseudo Terminal) for PTY support:

- Available since Windows 10 1809
- Tauri can use the `portable-pty` Rust crate
- Alternative: `conpty` crate directly
- Must handle Windows line endings (CRLF)
- xterm.js on the frontend renders the PTY output

### Process Management Pattern

From the associate project:

```rust
// Raw mode (natural terminal output)
Command::new("claude")
    .args(["-p", prompt, "--dangerously-skip-permissions"])
    .current_dir(cwd)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .stdin(Stdio::null())
    .spawn()

// Headless mode (structured JSON output)
Command::new("claude")
    .args(["-p", prompt, "--dangerously-skip-permissions",
           "--output-format", "stream-json", "--verbose"])
    .current_dir(cwd)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .stdin(Stdio::null())
    .spawn()
```

Read stdout/stderr on background threads with channels for non-blocking reads.

---

## 14. File Watcher Patterns

### What to Watch

| Path Pattern | What Changes | Debounce |
|-------------|-------------|----------|
| `~/.claude/teams/*/config.json` | Team membership, status | 500ms |
| `~/.claude/teams/*/inboxes/*.json` | New inbox messages | 200ms |
| `~/.claude/tasks/*/*.json` | Task state changes | 300ms |
| `~/.claude/projects/<encoded>/sessions-index.json` | New/updated sessions | 500ms |
| `~/.claude/projects/<encoded>/*.jsonl` | Transcript updates | 100ms (high freq) |
| `~/.claude/projects/<encoded>/*/subagents/*.jsonl` | Subagent activity | 200ms |
| `~/.claude/settings.json` | Settings changes | 1000ms |
| `<project>/.claude/settings.json` | Project settings | 1000ms |
| `<project>/.git/` | Git state changes | 500ms |

### Recommended Watcher Strategy

1. Use Rust `notify` crate for file system watching
2. Batch events with debounce timers per category
3. For transcripts: use incremental seek-based reading (don't re-read entire file)
4. For git: poll periodically (every 2-5 seconds) rather than watching `.git/`
5. For config files: watch specific files, not recursive directories

### Transcript Streaming Pattern

```
1. Watch transcript .jsonl file for changes
2. On change: seek to last known offset
3. Read new lines from offset to EOF
4. Parse each line as TranscriptEnvelope
5. Update UI with new items
6. Track new offset
```

---

## 15. IPC Patterns

### Tauri IPC Architecture

```
┌─────────────────────────────────────┐
│         React Frontend               │
│  ┌───────────┐  ┌────────────────┐  │
│  │ xterm.js  │  │  Panel UIs     │  │
│  │ Terminal  │  │  (Sessions,    │  │
│  │           │  │   Teams, Git,  │  │
│  │           │  │   Inbox, etc.) │  │
│  └─────┬─────┘  └───────┬────────┘  │
│        │                 │           │
│        │  Tauri invoke() │           │
│        │  & Events       │           │
└────────┼─────────────────┼───────────┘
         │                 │
    ┌────┴─────────────────┴────┐
    │       Tauri Rust Backend   │
    │  ┌──────────────────────┐ │
    │  │   PTY Manager        │ │  ← portable-pty, ConPTY
    │  │   (spawn/read/write) │ │
    │  ├──────────────────────┤ │
    │  │   File Watcher       │ │  ← notify crate
    │  │   (teams/tasks/etc)  │ │
    │  ├──────────────────────┤ │
    │  │   Transcript Reader  │ │  ← Incremental JSONL parser
    │  ├──────────────────────┤ │
    │  │   Git Runner         │ │  ← git commands
    │  ├──────────────────────┤ │
    │  │   Inbox Writer       │ │  ← Atomic JSON file writes
    │  └──────────────────────┘ │
    └───────────────────────────┘
```

### Communication Channels

1. **Frontend → Backend** (Tauri invoke):
   - `spawn_session(project_path, args)` → PTY handle
   - `send_pty_input(session_id, data)` → Write to PTY stdin
   - `load_sessions(project_path)` → Session list
   - `load_teams(project_cwd)` → Team list
   - `load_tasks(team_name)` → Task list
   - `load_inbox(team_name, agent_name)` → Inbox messages
   - `send_inbox_message(team_name, agent_name, message)` → Write message
   - `git_status(cwd)` → Git status
   - `git_diff(cwd, file, staged)` → File diff

2. **Backend → Frontend** (Tauri events):
   - `pty-output` → Terminal data stream
   - `transcript-update` → New transcript items
   - `team-changed` → Team config updated
   - `task-changed` → Task state updated
   - `inbox-changed` → New inbox messages
   - `git-changed` → Git status changed
   - `session-changed` → Sessions list updated

### Event-Driven Architecture

The Rust backend should run:
- One `notify` watcher thread for `~/.claude/` subtree
- Per-session PTY reader threads
- Main async event loop (tokio) dispatching to frontend

---

## 16. Windows-Specific Considerations

### ConPTY (Console Pseudo Terminal)

- Windows 10 1809+ required
- Use `portable-pty` crate which abstracts ConPTY
- ConPTY handles proper ANSI escape sequence translation
- Terminal size (rows, cols) must be set on the PTY

### Path Handling

- Windows uses `\` separator, Claude CLI stores paths with `\`
- Normalize paths for comparison (case-insensitive on Windows)
- The path encoding function must handle both `/` and `\`
- Git commands may return paths with `/` even on Windows

### File Watching on Windows

- `ReadDirectoryChangesW` is the underlying API (used by `notify` crate)
- Watch handles can be limited; consolidate watches where possible
- Network drives may not support file watching
- Use polling fallback for unreliable paths

### Process Spawning

- Use `CREATE_NO_WINDOW` flag for headless processes
- `cmd /C` not needed when spawning `claude` directly (it's a standalone binary)
- Environment variables are inherited from parent process
- PATH must include claude installation directory

### Shell Integration

- Default shell on Windows: PowerShell or cmd.exe
- Claude Code can be configured with `CLAUDE_CODE_SHELL=bash` (Git Bash)
- Hook scripts should be portable (prefer node/python over bash on Windows)
- Shell profile output can interfere with JSON parsing in hooks

### Memory Considerations

- WebView2 (Tauri backend) baseline: ~50-80MB
- Each Claude PTY session: ~20-30MB
- File watchers: minimal overhead
- Transcript parsing: cap items (5000) to prevent unbounded growth
- xterm.js: dispose terminals when switching to prevent leaks

### Atomic File Writes

For writing inbox messages and other shared files:
1. Write to a temp file in the same directory
2. Use `rename()` (atomic on same filesystem on Windows)
3. This prevents partial reads by other processes

---

## Appendix: Quick Reference Summary

### Starting a Session
```bash
cd /project/dir && claude                          # Interactive
claude -p "query" --output-format stream-json      # Headless/streaming
claude -c                                          # Continue last session
claude -r <uuid>                                   # Resume specific session
```

### Finding Sessions for a Project
```
encoded = encode_project_path("C:\dev\myproject")  # → "C--dev-myproject"
sessions_dir = ~/.claude/projects/{encoded}/
index = sessions_dir/sessions-index.json
```

### Finding Teams for a Project
```
teams_dir = ~/.claude/teams/
For each team config.json:
  Check if any member.cwd matches project path
```

### Sending a Message to an Agent
```
inbox_path = ~/.claude/teams/{team}/inboxes/{agent}.json
1. Read current array
2. Append message object
3. Atomic write back
```

### Watching for Changes
```
Primary watches:
  ~/.claude/teams/          → Team/inbox changes
  ~/.claude/tasks/          → Task changes
  ~/.claude/projects/{enc}/ → Session/transcript changes
  {project}/.git/           → Git changes (or poll)
```
