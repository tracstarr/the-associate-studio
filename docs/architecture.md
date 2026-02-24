# Architecture

## Overview

Single-window desktop IDE. One Tauri window contains everything: multiple Claude CLI sessions, git, PRs/Issues, file browsing/editing, plans, team/agent visibility, notifications, a neural field dashboard, and settings. No secondary windows, no system tray.

## Layout regions

```
+---------------------------------------------------------------------+
|  The Associate Studio  /  project-name            [bell] [- ] [# ] [x]  TitleBar (36px, custom)
+--+------------------------------------------------------------------+
|  |  [Tabs: New Session x  session2  +]                          | R |
|AB|----------------------------------------------------------    | A |
|  |                                                          |   | B |
|  | SIDEBAR (18%) | MAIN CONTENT AREA              | RIGHT  |   |   |
|  |               |                                 | (25%)  |   |   |
|  | Projects      |  xterm.js terminal              |        |   |   |
|  | Git           |  Session view (read-only)       | Contxt |   |   |
|  | Files         |  Plan editor (Monaco)           | Teams  |   |   |
|  | PRs           |  Readme editor (Monaco)         | Plans  |   |   |
|  |               |  File editor (Monaco)           |        |   |   |
|  |               |  Settings tab                   |        |   |   |
|  |               |  Diff viewer                    |        |   |   |
|  |               |                                 |        |   |   |
+--+------------------------------------------------------------------+
|  BOTTOM PANEL (full-width, 25%)                                     |
|  Log | Diff | PRs | Issues | Output                                 |
+---------------------------------------------------------------------+
|  [branch] [sessions] [agents] [unread]       [todos] [status]       |  StatusBar (24px)
+---------------------------------------------------------------------+

AB  = Left ActivityBar (48px, 4 sidebar views + bottom toggle + settings)
RAB = Right ActivityBar (48px, 3 right panel views)
```

| Region | Size | Collapsible | Keybind |
|--------|------|-------------|---------|
| TitleBar | 36px fixed | No | -- |
| Left ActivityBar | 48px fixed | No | -- |
| Right ActivityBar | 48px fixed | No | -- |
| Sidebar | 18% default | Yes | Ctrl+B |
| TabBar | 36px fixed | No | -- |
| Main Content | flex | No | -- |
| Right Panel | 25% default | Yes | Ctrl+Shift+B |
| Bottom Panel | 25% default | Yes | Ctrl+J |
| StatusBar | 24px fixed | No | -- |

### Key layout detail: full-width bottom panel

The bottom panel spans the full window width (below sidebar, main, and right panel). This is achieved by wrapping the layout in a `PanelGroup direction="vertical"` with the top section (containing sidebar/main/right) as one panel and the bottom panel as a second panel.

### Multi-project tabs

Tabs are per-project. `IDELayout` renders a `MainArea` for each project that has open tabs, showing/hiding via CSS `display`. Only the active project's `MainArea` is visible. This prevents unmounting terminal sessions when switching projects.

## Component tree

```
App.tsx
  ErrorBoundary (outer)
  QueryClientProvider (TanStack Query)
  ErrorBoundary (inner)
  IDEShell
    TitleBar            -- frameless drag + window controls + NotificationBell
    IDELayout           -- react-resizable-panels root (vertical)
      Panel (top)
        ActivityBar     -- 48px icon strip (Projects, Git, Files, PRs, Bottom toggle, Settings)
        PanelGroup (horizontal)
          Sidebar       -- ProjectSwitcher | GitStatusPanel | FileBrowserPanel | PRListPanel
          MainArea      -- per-project tab bar + content area
            TabBar      -- open session tabs with context menus (close all/others/left/right)
            TerminalView     -- xterm.js + PTY per tab (hidden, never unmounted)
            SessionView      -- read-only session transcript viewer
            PlanEditorView   -- Monaco editor for plan files
            ReadmeTab        -- Monaco editor for README.md
            FileEditorTab    -- Monaco editor for arbitrary files
            SettingsTab      -- settings as a main-area tab
            DiffViewer       -- inline diff viewer
            TabContextMenu   -- right-click context menu for tabs
            CloseTabsWarningDialog -- warns about active sessions / unsaved changes
          RightPanel    -- ContextPanel | TeamsRightPanel | PlansPanel
        RightActivityBar -- 48px icon strip (Context, Teams, Plans)
      Panel (bottom)
        BottomPanel     -- Log | Diff | PRs | Issues | Output tabs
    StatusBar           -- branch, counts, Claude status
    CommandPalette      -- cmdk modal
    NeuralFieldOverlay  -- fullscreen dashboard (Ctrl+Shift+Space)
    DebugPanel          -- DEV-only floating debug log
```

## Tab types

The main content area supports 7 tab types, distinguished by `SessionTab.type`:

| Type | Component | Description |
|------|-----------|-------------|
| `terminal` (default) | `TerminalView` | Live Claude CLI session via PTY |
| `session-view` | `SessionView` | Read-only transcript of a past session |
| `plan` | `PlanEditorView` | Monaco editor for `.md` plan files |
| `readme` | `ReadmeTab` | Monaco editor for README.md |
| `file` | `FileEditorTab` | Monaco editor for arbitrary files |
| `settings` | `SettingsTab` | Application settings |
| `diff` | `DiffViewer` | Git diff viewer for a specific file |

## Data flow

### Terminal session lifecycle
```
User clicks "New Session" -> sessionStore.openTab({ type: "terminal", cwd }, projectId)
  -> TerminalView mounts -> FitAddon.fit() -> get rows/cols
  -> invoke("pty_spawn", { sessionId, cwd, rows, cols })
  -> Rust: portable-pty opens ConPTY -> spawns "claude" (CLAUDECODE removed)
  -> reader thread -> emit "pty-data-{id}" events -> term.write(payload)
  -> User types -> term.onData -> invoke("pty_write", { sessionId, data })
  -> Tab close -> invoke("pty_kill") -> child.kill()
```

### File watcher -> reactive UI
```
~/.claude/ changes (notify crate, ReadDirectoryChangesW)
  -> debounce per category (100-500ms)
  -> Tauri emit: "claude-fs-change" { path, kind }
  -> useClaudeData hook invalidates relevant TanStack Query keys
  -> Components refetch automatically
```

### Settings + secrets
```
App mount -> loadFromDisk() + loadProjects()
  -> tauri-plugin-store ("settings.json") -> fontSize, fontFamily, jiraBaseUrl, jiraEmail, githubClientId
  -> invoke("cmd_load_integration_secrets")
  -> Rust: keyring::Entry::get_password() x 3 (github-token, linear-api-key, jira-api-token)
  -> settingsStore hydrated in memory
  -> projectsStore loads project list from ~/.claude/projects/
```

### Git actions -> Output panel
```
User triggers git action (fetch, pull, rebase, etc.) in GitStatusPanel
  -> useGitAction hook wraps the invoke call
  -> Logs "Running: {label}..." to outputStore
  -> Switches bottom panel to Output tab (auto-opens if closed)
  -> On success: logs "Done" to outputStore
  -> On error: logs error message to outputStore
```

### Notifications
```
TerminalView detects question pattern in PTY output
  -> notificationStore.addNotification({ tabId, projectId, sessionTitle, question })
  -> NotificationBell in TitleBar shows unread count badge
  -> Click notification -> switches to that tab + marks read
  -> Switching to a tab -> markReadByTabId(tabId)
```

## State management split

| Store | Library | Responsibility |
|-------|---------|----------------|
| `uiStore` | Zustand | Panel visibility, active views/tabs, command palette, neural field, debug panel, diff selection, project dropdown, tab init status |
| `sessionStore` | Zustand | Per-project open tabs, active tab ID per project, hook-tracked session state, subagents, plan links, dirty tabs |
| `settingsStore` | Zustand | Font settings, integration credentials (in-memory mirror of keyring) |
| `projectsStore` | Zustand | Project list, active project ID, project CRUD |
| `notificationStore` | Zustand | Question notifications from Claude sessions (unread tracking) |
| `outputStore` | Zustand | Output panel messages (git actions, system messages) |
| `debugStore` | Zustand | DEV-only debug log entries (max 500) |
| Server data | TanStack Query | Sessions, teams, inbox, tasks, todos, plans, git status/log/branches -- fetched via Tauri invoke |

## Sidebar views

The left ActivityBar controls which sidebar view is shown:

| View | Keybind | Component | Description |
|------|---------|-----------|-------------|
| Sessions | Ctrl+1 | `ProjectSwitcher` | Project list + session management |
| Git | Ctrl+2 | `GitStatusPanel` | Staged/unstaged changes, branch ops, git actions |
| Files | -- | `FileBrowserPanel` | File tree browser for the active project |
| PRs | Ctrl+3 | `PRListPanel` | Pull requests list (via `gh` CLI) |

## Right panel views

The right ActivityBar controls which right panel view is shown:

| View | Component | Description |
|------|-----------|-------------|
| Context | `ContextPanel` | CLAUDE.md content + memory files |
| Teams | `TeamsRightPanel` | Team/agent status for active session |
| Plans | `PlansPanel` | List and manage plan files |

## Bottom panel tabs

| Tab | Component | Description |
|-----|-----------|-------------|
| Log | `GitLogPanel` | Git commit log |
| Diff | `DiffViewer` | Diff for selected file from git panel |
| PRs | `PRListPanel` | Pull requests (shared component) |
| Issues | `IssueListPanel` | GitHub issues |
| Output | `OutputPanel` | Git action output + system messages |

## Hook event pipeline

Live session tracking flows through a dedicated pipeline separate from the main file watcher:

```
Claude CLI process
  +-- SessionStart / SubagentStart / Stop hooks fire
       +-- PowerShell inline command appends JSON line to ~/.claude/theassociate/hook-events.jsonl

claude_watcher.rs (notify crate)
  +-- Watches ~/.claude/theassociate/ (NonRecursive)
       +-- On hook-events.jsonl change: seeks to persisted offset, reads new lines
            +-- Persists new offset to watcher-state.json BEFORE processing (crash-safe)
            +-- Parses each line as HookEvent
                 +-- On Stop event with completion summary: saves markdown to project dir
                      +-- app_handle.emit("session-summary", &SummaryPayload)
                 +-- app_handle.emit("hook-event", &hook_event)

useClaudeWatcher (React)
  +-- listen("hook-event", handler)
       +-- SessionStart  -> resolveTabSession(tab, realSessionId), markSessionActive(true)
       +-- SessionEnd    -> markSessionActive(false)
       +-- SubagentStart -> setSubagents(sessionId, [...current, newAgent])
       +-- SubagentStop  -> setSubagents(sessionId, current.filter(...))

sessionStore (Zustand)
  +-- knownSessions: Record<sessionId, isActive>
  +-- activeSubagents: Record<sessionId, ActiveSubagent[]>
  +-- tabsByProject[projectId][].resolvedSessionId -- links fake tab ID to real Claude UUID

UI
  +-- SessionsList: green pulsing dot when live, N badge for subagents
  +-- TeamsPanel / InboxPanel: filter to teams matching active session's leadSessionId
```

### Tab <-> session linking

PTY tabs are created with a fake ID (`session-{timestamp}`) and `spawnedAt = Date.now()`.
When a `SessionStart` hook fires, the frontend matches by `cwd` + recency (within 30s)
to link `tab.resolvedSessionId = event.session_id`. Resume case matches by `sessionId` directly.

### Hook setup

Hooks are written into `~/.claude/settings.json` under the `hooks` key by `cmd_setup_hooks`.
The command is an inline PowerShell snippet using `$env:USERPROFILE` (no hardcoded username).
All 5 hook events (SessionStart/End, SubagentStart/Stop, Stop) are set to `async: true`
so they never block Claude CLI execution. Hook events are written to `~/.claude/theassociate/`.

### Persistent hook-event offset

The watcher persists the byte offset of `hook-events.jsonl` to `~/.claude/theassociate/watcher-state.json` via `WatcherState` (`data/watcher_state.rs`). This prevents re-emitting old hook events on app restart and avoids missed events between sessions.

Startup behavior:
- If `hook-events.jsonl` exists but has no saved offset (first launch), the offset is pre-populated to the current file length, skipping historical events.
- If the file has been truncated (offset > file length), the offset resets to 0.
- The offset is persisted **before** processing new lines for crash safety.

### Session completion summaries

When a `Stop` hook event includes a `last_assistant_message` that qualifies as a completion summary (contains "# Summary" heading, or is >200 chars with "summary" keyword or numbered steps), the watcher saves it as a markdown file:

```
~/.claude/projects/{encoded-path}/{session-id}-summary-NNN.md
```

A `session-summary` Tauri event is emitted with a `SummaryPayload` containing `session_id`, `project_path`, `project_dir`, `filename`, and a 200-char `preview`. The frontend invalidates the `["summaries"]` TanStack Query cache.

Summaries can be loaded via `cmd_load_summaries(project_dir, session_id)` and read via `cmd_read_summary(project_dir, filename)`.

## Rust backend structure

### Commands (`src-tauri/src/commands/`)

| Module | Commands |
|--------|----------|
| `sessions` | `cmd_load_sessions`, `cmd_load_transcript` |
| `teams` | `cmd_load_teams`, `cmd_delete_team` |
| `tasks` | `cmd_load_tasks` |
| `inbox` | `cmd_load_inbox`, `cmd_send_inbox_message` |
| `todos` | `cmd_load_todos` |
| `plans` | `cmd_load_plans`, `cmd_read_plan`, `cmd_save_plan` |
| `git` | `cmd_git_status`, `cmd_git_diff`, `cmd_git_branches`, `cmd_git_current_branch`, `cmd_git_log`, `cmd_git_remote_branches`, `cmd_create_worktree`, `cmd_list_worktrees`, `cmd_get_worktree_copy`, `cmd_set_worktree_copy`, `cmd_claude_git_action`, `cmd_git_fetch`, `cmd_git_pull`, `cmd_git_create_branch`, `cmd_git_add`, `cmd_git_ignore`, `cmd_git_rebase` |
| `pty` | `pty_spawn`, `pty_resize`, `pty_write`, `pty_kill`, `pty_list` |
| `issues` | `cmd_list_prs`, `cmd_list_issues`, `cmd_list_linear_issues` |
| `summaries` | `cmd_load_summaries`, `cmd_read_summary` |
| `integrations` | `cmd_load_integration_secrets`, `cmd_github_auth_status`, `cmd_github_device_flow_start`, `cmd_github_device_flow_poll`, `cmd_github_set_token`, `cmd_github_logout`, `cmd_linear_verify_key`, `cmd_linear_logout`, `cmd_jira_verify_token`, `cmd_jira_logout` |
| `hooks` | `cmd_setup_hooks`, `cmd_remove_hooks`, `cmd_get_active_sessions`, `cmd_hooks_configured` |
| `projects` | `cmd_list_projects`, `cmd_list_orphaned_projects`, `cmd_pick_folder`, `cmd_delete_project`, `cmd_get_home_dir`, `cmd_read_file`, `cmd_write_file`, `cmd_run_claude_init`, `cmd_run_readme_gen`, `cmd_get_project_settings`, `cmd_set_project_settings`, `cmd_run_docs_index_gen` |
| `files` | `cmd_list_dir` |

### Data layer (`src-tauri/src/data/`)

| Module | Purpose |
|--------|---------|
| `sessions` | Read session data from `~/.claude/projects/` |
| `teams` | Read team data from session directories |
| `inboxes` | Read/write inbox messages |
| `tasks` | Read task data from session directories |
| `todos` | Read todo data from session directories |
| `plans` | Read/write plan `.md` files |
| `transcripts` | Parse JSONL transcript files |
| `git` | Git operations via `git2` crate + `gh` CLI |
| `hook_state` | Manage hook event JSONL file state |
| `summaries` | Save/load session completion summaries as markdown files |
| `watcher_state` | Persist watcher offsets (hook-events.jsonl position) across restarts |
| `projects` | Project discovery and management |
| `path_encoding` | Encode filesystem paths to safe directory names |

### Models (`src-tauri/src/models/`)

| Module | Purpose |
|--------|---------|
| `session` | Session metadata model |
| `team` | Team/agent model |
| `inbox` | Inbox message model |
| `task` | Task model |
| `todo` | Todo item model |
| `plan` | Plan file metadata model |
| `transcript` | Transcript message model |
| `git` | Git status/diff/branch models |
| `hook_event` | Hook event types (SessionStart/End, SubagentStart/Stop) |
| `summary` | Session completion summary file model |

## Neural Field Dashboard

Fullscreen overlay (`Ctrl+Shift+Space`) that visualizes active sessions, teams, and agents as an animated node graph. Uses `<canvas>` for rendering with physics-based layout. Shows HUD counters for sessions, teams, and agents. Clicking a node can navigate to that session.

## Per-project IDE settings

Settings specific to a project (e.g., the docs folder path) are stored in `~/.claude/projects/{encoded-path}/ide-settings.json` as a JSON file:

```json
{ "docsFolder": "docs" }
```

This keeps them alongside session data and out of the project repository. The Rust struct is `ProjectSettings` in `commands/projects.rs`; read/write via `cmd_get_project_settings` / `cmd_set_project_settings`.

## Key architectural patterns

1. **Per-project tab isolation**: Tabs are stored in `tabsByProject[projectId]`, preventing cross-project tab leakage. Active tab is tracked per-project in `activeTabByProject`.

2. **Never-unmount terminals**: Terminal tabs are rendered with `display: none/block` rather than conditional mounting, so PTY processes are never accidentally killed by React re-renders.

3. **Dirty tab tracking**: `sessionStore.dirtyTabs` tracks unsaved changes. `CloseTabsWarningDialog` warns before closing tabs with active sessions or unsaved changes.

4. **Tab context menus**: Right-click on tabs provides Close, Close Others, Close to Left, Close to Right, Close All -- with warning dialogs for destructive actions.

5. **Dual activity bars**: Left ActivityBar controls sidebar views, Right ActivityBar controls right panel views. Both are 48px fixed-width strips.
