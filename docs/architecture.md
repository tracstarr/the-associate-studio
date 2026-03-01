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
|  |               |  File editor (Monaco)           | Notes  |   |   |
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
RAB = Right ActivityBar (48px, 6 right panel views)
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
            SessionContextMenu  -- right-click context menu for session items (Resume/Fork/Delete)
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
          RightPanel    -- ContextPanel | TeamsRightPanel | PlansPanel | DocsSection | NotesPanel | TaskHistoryPanel
        RightActivityBar -- 48px icon strip (Context, Teams, Plans, Docs, Notes, Task History)
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

### Project creation (Open / New Project)
```
User clicks "Open…" or "New Project…" in project dropdown
  -> pickFolder() native file dialog
  -> addAndActivateProject(path)
     -> Optimistic: adds project to store + sets active
     -> Backend: createProject(path)
        -> Rust: cmd_create_project
           -> encode_project_path(path)
           -> mkdir ~/.claude/projects/{encoded}/
           -> write sessions-index.json with { version: 1, originalPath, entries: [] }
        -> Returns ProjectInfo
  -> Project now discoverable by discover_projects() on reload
  -> User can immediately create Claude sessions in the project
```

**Key detail**: `discover_projects()` resolves the canonical project path using a 3-tier fallback:
1. `project_path` from session entries (most authoritative)
2. `originalPath` from `sessions-index.json` (works for newly created projects with no sessions)
3. `decode_dir_name()` best-effort decode (lossy — dashes in path segments become slashes)

### File selection -> Note capture

```
User selects text in FileEditorTab (Monaco editor)
  -> onDidChangeCursorSelection fires
  -> Computes line range + 200-char quote + pixel position
  -> Floating "Add to note" button appears above selection
  -> User clicks (onMouseDown + preventDefault to preserve selection)
  -> openNotesWithRef({ filePath, lineStart, lineEnd, quote })
     -> uiStore: pendingNoteRef = ref, activeRightTab = "notes", rightPanelOpen = true
  -> NotesPanel mounts / becomes visible
     -> useEffect sees pendingNoteRef != null
     -> Creates new Note with FileRef pre-filled, calls cmd_save_note
     -> On success: navigates to NoteEditor for the new note
     -> Clears pendingNoteRef
```

### Notes -> file tab indicator

```
useGlobalNotes() + useProjectNotes() run in MainAreaComponent
  -> noteFileSet = Set of all filePaths referenced in any note (normalized, lowercase)
  -> Each "file" tab renders TabNoteIndicator
     -> If tab.filePath is in noteFileSet: shows accent-primary dot
     -> Clicking dot: setRightTab("notes"), opens right panel if closed
```

### Git branch change detection
```
Active project changes (projectsStore)
  -> useGitBranchWatcher() calls watchGitHead(project.path)
  -> Rust: cmd_watch_git_head(cwd)
     -> git2::Repository::discover(cwd) resolves actual .git dir (handles worktrees)
     -> notify watcher starts on .git/ directory (NonRecursive)
     -> Background thread: reads HEAD on every fs event, debounces 100ms
        -> If branch changed: app_handle.emit("git-branch-changed", { cwd, branch })
  -> Previous watcher (if any) is dropped via GitWatcherState managed state

useClaudeWatcher (React)
  -> listen("git-branch-changed", handler)
     -> Invalidates TanStack Query keys:
        git-current-branch, git-branches, git-status, git-log, git-remote-branches
     -> All UI components (TitleBar branch chip, StatusBar, GitStatusPanel, GitLogPanel)
        re-render automatically via React Query refetch
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

### Remote Run — issue to PR
```
User opens issue detail tab (GitHub / Jira / Linear)
  -> useRemoteRun hook checks workflow exists (cmd_check_remote_run_workflow)
  -> User clicks "Remote Run" button
  -> triggerRemoteRun(cwd, issueNumber, issueType)
     -> Rust: gh workflow run remote-run.yml --field issue_number=X --field issue_type=Y
     -> Retries up to 3x (2s apart) to resolve run ID from gh run list
     -> Returns RemoteRunResult { runId, runUrl }
  -> sessionStore: tab.remoteRunId + tab.remoteRunUrl set
  -> Status badge renders: Queued
  -> Poll every 15s: getRemoteRunStatus(cwd, runId)
     -> Rust: gh run view {id} --json status,conclusion,url
     -> Returns WorkflowRunStatus { status, conclusion, url }
  -> sessionStore: tab.remoteRunStatus + tab.remoteRunConclusion updated
  -> Badge updates: In Progress -> Passed | Failed | Cancelled
  -> Clicking badge opens GitHub Actions run URL in browser

GitHub Actions (remote-run.yml):
  -> Fetch issue from GitHub / Jira REST API / Linear GraphQL
  -> Extract prompt between **Prompt Start** / **Prompt End** markers (or use full body)
  -> Create branch: remote-run/{sanitized-issue-id}
  -> Run anthropics/claude-code-action@main with extracted prompt
  -> If changes produced: commit + force-push + gh pr create
```

### Task history snapshotting

Tasks in `~/.claude/tasks/{team_name}/` are ephemeral — Claude deletes them on completion. The IDE snapshots each task write before it disappears:

```
File event on ~/.claude/tasks/{team}/N.json
  -> claude_watcher.rs (task branch)
     -> Read + parse task JSON
     -> Read ~/.claude/teams/{team}/config.json → find first member CWD
     -> encode_project_path(cwd) → encoded
     -> data::task_snapshots::upsert_task_snapshot(claude_home, encoded, team, task, now)
        -> Load ~/.claude/theassociate/projects/{encoded}/task-snapshots/{team}.json (or empty)
        -> Create TaskRecord on first-seen (first_seen = now)
        -> Always update last_seen + snapshot
        -> Push StatusChange if status differs from last recorded
        -> Atomic write via .tmp rename
     -> Emit "task-snapshot-changed" { team_name, encoded_project_dir }
  -> Still emit "task-changed" (live task list unaffected)

useClaudeWatcher (React)
  -> listen("task-snapshot-changed")
  -> queryClient.invalidateQueries(["task-snapshots"])
  -> useTaskSnapshots(projectDir, teamName) refetches
  -> TaskHistoryPanel re-renders with updated history
```

**Storage**: `~/.claude/theassociate/projects/{encoded}/task-snapshots/{team_name}.json`

**Format**: `TaskSnapshotFile` — map of task ID → `TaskRecord` with `statusChanges[]`, `firstSeen`, `lastSeen`, and full `snapshot`. Persists even after Claude deletes the live task file.

**Project association**: determined by the first team member with a non-empty `cwd` field in `config.json`. If no CWD is found, the task is not snapshotted (can't associate it with a project).

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
| `uiStore` | Zustand | Panel visibility, active views/tabs, command palette, neural field, debug panel, diff selection, project dropdown, tab init status, `pendingNoteRef` for file-selection→note flow |
| `sessionStore` | Zustand | Per-project open tabs, active tab ID per project, hook-tracked session state, subagents, plan links, dirty tabs |
| `settingsStore` | Zustand | Font settings, integration credentials (in-memory mirror of keyring) |
| `projectsStore` | Zustand | Project list, active project ID, project CRUD |
| `notificationStore` | Zustand | Question notifications from Claude sessions (unread tracking) |
| `outputStore` | Zustand | Output panel messages (git actions, system messages) |
| `debugStore` | Zustand | DEV-only debug log entries (max 500) |
| Server data | TanStack Query | Sessions, teams, inbox, tasks, todos, plans, notes, git status/log/branches -- fetched via Tauri invoke |

## Session tree view (`ProjectSwitcher`)

The Sessions sidebar shows a collapsible tree for each session:

```
▼ Fix login bug (abc123) ●
  ├── 📄 dark-mode-plan.md    (click → opens plan tab)
  ├── 📋 Summary 1            (click → opens summary tab)
  ├── 🤖 explorer · a5d8fd3a  (click → opens subagent transcript tab)  42
  └── 🤖 tester · a780eff5    (click → opens subagent transcript tab)  18
▶ Old session (def456)
```

- Clicking the chevron expands/collapses the tree node
- Clicking the session title opens a session-view tab
- Children are loaded lazily: plans from `planLinks[filename] === sessionId`; summaries from `useSummaries(projectId, sessionId)`; subagents from `useSubagentSessions(projectDir, sessionId)`
- `NewSessionTabItem` shows freshly-spawned tabs that haven't yet been persisted to `sessions-index.json`

### Subagent session entries

Claude Code CLI stores subagent transcripts inside the session subdirectory:

```
~/.claude/projects/{encoded}/
└── {session-uuid}/
    ├── subagents/
    │   └── agent-{id}.jsonl    ← isSidechain: true, full transcript
    └── tool-results/
        └── {id}.txt            ← raw hook metadata (not surfaced in UI)
```

`cmd_load_subagent_sessions(projectDir, sessionId)` scans `{session_uuid}/subagents/*.jsonl`, reads up to 30 lines per file for first prompt and message count, and returns `Vec<SubagentSessionEntry>` sorted chronologically.

Clicking a subagent row opens a `session-view` tab with `tab.filePath = subagent.jsonlPath`. `SessionView` checks `tab.filePath` first before deriving the path from `homeDir + projectDir + sessionId`, so subagent transcripts display in the same viewer as parent sessions without any new tab type.

`tool-results/` files contain Stop hook metadata (last assistant message, cwd, permission mode) — not conversation content. They are intentionally not surfaced in the UI.

## planLinks semantics

`sessionStore.planLinks` is a `Record<string, string>` mapping **plan filename → real Claude session ID** (the UUID from the `SessionStart` hook event, e.g. `"abc12345-..."`). It is persisted to `~/.claude/theassociate/plan-links.json` (via `cmd_save_plan_links` / `cmd_load_plan_links`) and hydrated from disk on startup in `App.tsx`.

- `openPlanTab(filename, title, projectId)` auto-links the plan to the active terminal tab's `resolvedSessionId` (or `sessionId`) **if not already linked**
- `linkPlan(filename, sessionId)` sets the mapping explicitly
- `relinkPlan(filename, sessionId)` updates an existing mapping (for future UI, e.g. context menu "link to this session")

### plan-linked event → session ID resolution

When Claude CLI enters plan mode, the PTY reader detects the plan file path in terminal output and emits a `plan-linked` Tauri event with `{ tab_id, filename }`. The `useClaudeData` handler in `src/hooks/useClaudeData.ts` scans `tabsByProject` to find the terminal tab matching `tab_id`, then extracts `tab.resolvedSessionId ?? tab.sessionId` as the real session ID to pass to `linkPlan`. The owning project ID is also taken from the tab scan rather than from the active project, so plans are always linked to the correct project even when the user is viewing a different project.

**Fallback**: if the tab hasn't been resolved to a real session ID yet (plan-linked fired before the `SessionStart` hook), `payload.tab_id` is used temporarily. The link stays as the tab ID until the user manually re-opens via Plans Panel, which triggers `openPlanTab`'s auto-link on the second pass.

`PlansPanel` uses `planLinks[filename]` as a session ID to look up the session title via `useSessions` and load summaries via `useSummaries(projectId, sessionId)`. `ProjectSwitcher` filters plan children with `planLinks[filename] === session.sessionId`. Both require a real session UUID — **never a tab DOM ID** — to match correctly. The "No active plans" state shows when no plan has a linked session ID.

## Sidebar views

The left ActivityBar controls which sidebar view is shown:

| View | Keybind | Component | Description |
|------|---------|-----------|-------------|
| Sessions | Ctrl+1 | `ProjectSwitcher` | Project list + session management (tree view) |
| Git | Ctrl+2 | `GitStatusPanel` | Staged/unstaged changes, branch ops, git actions |
| Files | -- | `FileBrowserPanel` | File tree browser for the active project |
| PRs | Ctrl+3 | `PRListPanel` | Pull requests list (via `gh` CLI) |

## Right panel views

The right ActivityBar controls which right panel view is shown:

| View | Component | Description |
|------|-----------|-------------|
| Context | `ContextPanel` | Tasks/todos, memory files, and extensions for the active session |
| Teams | `TeamsRightPanel` | Team/agent status for active session |
| Plans | `PlansPanel` | List and manage plan files |
| Docs | `DocsSection` | Project documentation browser |
| Notes | `NotesPanel` | Per-project and global markdown notes scratchpad |
| Task History | `TaskHistoryPanel` | Historical task snapshots per team, persisted after Claude deletes live task files |

## Bottom panel tabs

| Tab | Component | Description |
|-----|-----------|-------------|
| Log | `GitLogPanel` | Git commit log |
| Diff | `DiffViewer` | Diff for selected file from git panel |
| PRs | `PRListPanel` | Pull requests (shared component) |
| Issues | `IssueListPanel` | GitHub, Linear, and Jira issues; includes "New" button to create issues via `CreateIssueModal` |
| Workflows | `WorkflowsPanel` | GitHub Actions workflow files + run list with auto-polling |
| Output | `OutputPanel` | Git action output + system messages |

### Workflow polling

The workflows panel auto-refreshes to keep run statuses current:

| Context | Interval | What refreshes |
|---------|----------|----------------|
| Workflows bottom tab visible | 3 s | Run list (catches new runs + status changes for queued/in-progress runs) |
| Workflow run open in main tab & run is active (queued/in_progress) | 1 s | Run detail (jobs, status) + logs |

Polling stops automatically when the workflows tab is unmounted (conditionally rendered in `BottomPanel`) or when a run enters a terminal state (completed/failed). Uses React Query `refetchInterval`.

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
~/.claude/theassociate/projects/{encoded-path}/summaries/{session-id}-summary-NNN.md
```

A `session-summary` Tauri event is emitted with a `SummaryPayload` containing `session_id`, `project_path`, `project_dir`, `filename`, and a 200-char `preview`. The frontend invalidates the `["summaries"]` TanStack Query cache. A completion notification is only shown if there is an **open terminal tab** for that session (non-terminal tabs like session-view, summary, or plan tabs do not trigger notifications).

Summaries can be loaded via `cmd_load_summaries(project_dir, session_id)` and read via `cmd_read_summary(project_dir, filename)`.

## Rust backend structure

### Commands (`src-tauri/src/commands/`)

| Module | Commands |
|--------|----------|
| `sessions` | `cmd_load_sessions`, `cmd_load_transcript`, `cmd_delete_session` |
| `teams` | `cmd_load_teams`, `cmd_delete_team` |
| `tasks` | `cmd_load_tasks` |
| `inbox` | `cmd_load_inbox`, `cmd_send_inbox_message` |
| `todos` | `cmd_load_todos` |
| `plans` | `cmd_load_plans`, `cmd_read_plan`, `cmd_save_plan` |
| `plan_links` | `cmd_load_plan_links`, `cmd_save_plan_links` |
| `notes` | `cmd_load_global_notes`, `cmd_load_project_notes`, `cmd_save_note`, `cmd_delete_note` |
| `git` | `cmd_git_status`, `cmd_git_diff`, `cmd_git_branches`, `cmd_git_current_branch`, `cmd_git_log`, `cmd_git_remote_branches`, `cmd_create_worktree`, `cmd_list_worktrees`, `cmd_get_worktree_copy`, `cmd_set_worktree_copy`, `cmd_claude_git_action`, `cmd_git_fetch`, `cmd_git_pull`, `cmd_git_create_branch`, `cmd_git_add`, `cmd_git_ignore`, `cmd_git_rebase`, `cmd_watch_git_head` |
| `pty` | `pty_spawn`, `pty_resize`, `pty_write`, `pty_kill`, `pty_list` |
| `issues` | `cmd_list_prs`, `cmd_list_issues`, `cmd_list_linear_issues` |
| `remote_run` | `cmd_check_remote_run_workflow`, `cmd_trigger_remote_run`, `cmd_get_remote_run_status`, `cmd_list_repo_secrets`, `cmd_set_repo_secret` |
| `summaries` | `cmd_load_summaries`, `cmd_read_summary` |
| `integrations` | `cmd_load_integration_secrets`, `cmd_github_auth_status`, `cmd_github_device_flow_start`, `cmd_github_device_flow_poll`, `cmd_github_set_token`, `cmd_github_logout`, `cmd_linear_verify_key`, `cmd_linear_logout`, `cmd_jira_verify_token`, `cmd_jira_logout` |
| `hooks` | `cmd_setup_hooks`, `cmd_remove_hooks`, `cmd_get_active_sessions`, `cmd_hooks_configured` |
| `projects` | `cmd_list_projects`, `cmd_list_orphaned_projects`, `cmd_pick_folder`, `cmd_delete_project`, `cmd_create_project`, `cmd_get_home_dir`, `cmd_read_file`, `cmd_write_file`, `cmd_run_claude_init`, `cmd_run_readme_gen`, `cmd_get_project_settings`, `cmd_set_project_settings`, `cmd_detect_docs_folder`, `cmd_run_docs_index_gen` |
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
| `notes` | Read/write/delete note `.json` files (global + per-project) |
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
| `note` | Note and FileRef models |
| `summary` | Session completion summary file model |

## Neural Field Dashboard

Fullscreen overlay (`Ctrl+Shift+Space`) that visualizes active sessions, teams, and agents as an animated node graph. Uses `<canvas>` for rendering with physics-based layout. Shows HUD counters for sessions, teams, and agents. Clicking a node can navigate to that session.

## Storage layout

All files *written* by the IDE live under `~/.claude/theassociate/`. Claude CLI's own directories (`~/.claude/projects/`, `~/.claude/plans/`, etc.) are read-only from the IDE's perspective.

```
~/.claude/theassociate/
├── hook-events.jsonl             ← written by CLI hooks
├── watcher-state.json            ← watcher byte-offset persistence
├── plan-links.json               ← plan filename → session UUID mapping
└── projects/
    └── {encoded-path}/
        ├── ide-settings.json     ← per-project IDE settings
        ├── notes/                ← per-project notes ({id}.json)
        └── summaries/
            └── {id}-summary-NNN.md
```

Global notes remain at `~/.claude/notes/` (written by the IDE, no conflict risk there).

## Per-project IDE settings

Settings specific to a project are stored in `~/.claude/theassociate/projects/{encoded-path}/ide-settings.json` as a JSON file:

```json
{
  "docsFolder": "docs",
  "issueFilters": {
    "state": "open",
    "ghAssignees": [],
    "linearAssignees": [],
    "jiraAssignees": [],
    "labelFilter": [],
    "activeProviders": [],
    "prState": "open"
  }
}
```

Read/write via `cmd_get_project_settings` / `cmd_set_project_settings`. The Rust helper `get_theassociate_home()` in `commands/projects.rs` provides the `~/.claude/theassociate` base path shared across all commands.

All fields in `ProjectSettings` are `Option<_>` so absent fields are treated as defaults — backward compatible.

### Issue filter persistence

Issue filter state (state, assignees, labels, providers) is per-project UI state stored under the `issueFilters` key in `ide-settings.json`. The `useIssueFilterStore` (keyed by raw project path, not encoded ID) loads filters via `loadFiltersForProject(projectPath)` on project switch, and debounce-persists via a read-before-write to preserve other `ProjectSettings` fields.

### Docs folder auto-detection

When no `docsFolder` is configured, the Docs section in the context panel automatically scans the project root for common documentation folder names. The Rust command `cmd_detect_docs_folder` checks for directories matching (case-insensitive, in priority order): `docs`, `doc`, `documents`, `documentation`. If found, the first match is used as the effective docs folder without persisting to settings. The user sees a "save" link to confirm the auto-detected folder into `ide-settings.json`.

## Key architectural patterns

1. **Per-project tab isolation**: Tabs are stored in `tabsByProject[projectId]`, preventing cross-project tab leakage. Active tab is tracked per-project in `activeTabByProject`.

2. **Never-unmount terminals**: Terminal tabs are rendered with `display: none/block` rather than conditional mounting, so PTY processes are never accidentally killed by React re-renders.

3. **Dirty tab tracking**: `sessionStore.dirtyTabs` tracks unsaved changes. `CloseTabsWarningDialog` warns before closing tabs with active sessions or unsaved changes.

4. **Tab context menus**: Right-click on tabs provides Close, Close Others, Close to Left, Close to Right, Close All -- with warning dialogs for destructive actions.

5. **Session context menus**: Right-click on any session in the sidebar (`ProjectSwitcher`) shows a `SessionContextMenu` with Resume in terminal, Fork into new session, and Delete. Delete is disabled for live (pulsing) sessions. All sessions are shown regardless of whether hook events were observed for them (externally-run and historical sessions are always visible; `isLive`/`isOpen` indicators simply show as absent).

6. **Dual activity bars**: Left ActivityBar controls sidebar views, Right ActivityBar controls right panel views. Both are 48px fixed-width strips.

7. **Notes as first-class UI objects**: Notes live in `~/.claude/notes/` (global) or `~/.claude/projects/{encoded}/notes/` (per-project) as individual JSON files. The `pendingNoteRef` field in `uiStore` is the handoff point between the Monaco editor's selection listener and the NotesPanel — it carries `{ filePath, lineStart, lineEnd, quote }` and clears itself after the panel consumes it. File tab dot indicators are computed in `MainArea` via a `useMemo` over all note file refs, avoiding any per-tab store lookups.
