# Architecture

## Overview

Single-window desktop IDE. One Tauri window contains everything: multiple Claude CLI sessions, git, PRs/Issues, team/agent visibility, and settings. No secondary windows, no system tray.

## Layout regions

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude IDE  /  project-name                    [─] [□] [✕]    │  TitleBar (36px, custom)
├──┬──────────────────────────────────────────────────────────────┤
│  │ [Tabs: New Session ×  session2  +]                           │  TabBar (36px)
│AB│──────────────────────────────────────────────────────────────│
│  │                                                              │
│  │ SIDEBAR (240px) │ MAIN CONTENT AREA        │ RIGHT (320px)  │
│  │                 │                           │                │
│  │ Projects        │  xterm.js terminal        │ Context/Teams  │
│  │ Sessions        │  (Claude CLI session)     │ Inbox/Plans    │
│  │ Git             │                           │                │
│  │ PRs/Issues      │──────────────────────────────────────────  │
│  │                 │ BOTTOM PANEL (200px)                       │
│  │                 │ Git │ PRs │ Issues                         │
├──┴─────────────────┴──────────────────────────────────────────┤
│  [branch] [sessions] [agents] [unread]         [todos] [status]│  StatusBar (24px)
└─────────────────────────────────────────────────────────────────┘
```

| Region | Size | Collapsible | Keybind |
|--------|------|-------------|---------|
| TitleBar | 36px fixed | No | — |
| ActivityBar | 48px fixed | No | — |
| Sidebar | 240px | Yes | Ctrl+B |
| TabBar | 36px fixed | No | — |
| Main Content | flex | No | — |
| Right Panel | 320px | Yes | Ctrl+Shift+B |
| Bottom Panel | 200px | Yes | Ctrl+J |
| StatusBar | 24px fixed | No | — |

## Component tree

```
App.tsx
  QueryClientProvider (TanStack Query)
  IDEShell
    TitleBar          — frameless drag + window controls
    IDELayout         — react-resizable-panels root
      ActivityBar     — 48px icon strip, switches sidebar view
      Sidebar         — SessionsList | TeamsPanel | InboxPanel | GitStatusPanel | PRListPanel/IssueListPanel
      MainArea
        TabBar        — open session tabs
        TerminalView  — xterm.js + PTY per tab (hidden, never unmounted)
        BottomPanel   — Git / PRs / Issues tabs
      RightPanel      — ContextPanel | TeamsRightPanel | InboxRightPanel | PlansPanel
    StatusBar         — branch, counts, Claude status
    CommandPalette    — cmdk modal
    SettingsPanel     — Appearance + Integrations tabs
```

## Data flow

### Terminal session lifecycle
```
User clicks "New Session" → sessionStore.openTab({ type: "terminal", cwd })
  → TerminalView mounts → FitAddon.fit() → get rows/cols
  → invoke("pty_spawn", { sessionId, cwd, rows, cols })
  → Rust: portable-pty opens ConPTY → spawns "claude" (CLAUDECODE removed)
  → reader thread → emit "pty-data-{id}" events → term.write(payload)
  → User types → term.onData → invoke("pty_write", { sessionId, data })
  → Tab close → invoke("pty_kill") → child.kill()
```

### File watcher → reactive UI
```
~/.claude/ changes (notify crate, ReadDirectoryChangesW)
  → debounce per category (100-500ms)
  → Tauri emit: "claude-fs-change" { path, kind }
  → useClaudeData hook invalidates relevant TanStack Query keys
  → Components refetch automatically
```

### Settings + secrets
```
App mount → loadFromDisk()
  → tauri-plugin-store ("settings.json") → fontSize, fontFamily, jiraBaseUrl, jiraEmail, githubClientId
  → invoke("cmd_load_integration_secrets")
  → Rust: keyring::Entry::get_password() × 3 (github-token, linear-api-key, jira-api-token)
  → settingsStore hydrated in memory
```

## State management split

| Store | Library | Responsibility |
|-------|---------|----------------|
| `uiStore` | Zustand | Panel visibility, active tab, sidebar view, settings open |
| `sessionStore` | Zustand | Open tabs, active tab ID, project dir, hook-tracked session state |
| `settingsStore` | Zustand | Font, integration credentials (in-memory mirror of keyring) |
| Server data | TanStack Query | Sessions, teams, inbox, tasks, git — fetched via Tauri invoke |

## Hook event pipeline

Live session tracking flows through a dedicated pipeline separate from the main file watcher:

```
Claude CLI process
  └─ SessionStart / SubagentStart / Stop hooks fire
       └─ PowerShell inline command appends JSON line to ~/.claude/ide/hook-events.jsonl

claude_watcher.rs (notify crate)
  └─ Watches ~/.claude/ide/ (NonRecursive)
       └─ On hook-events.jsonl change: seeks to last_hook_offset, reads new lines
            └─ Parses each line as HookEvent
                 └─ app_handle.emit("hook-event", &hook_event)

useClaudeWatcher (React)
  └─ listen("hook-event", handler)
       └─ SessionStart  → resolveTabSession(tab, realSessionId), markSessionActive(true)
       └─ SessionEnd    → markSessionActive(false)
       └─ SubagentStart → setSubagents(sessionId, [...current, newAgent])
       └─ SubagentStop  → setSubagents(sessionId, current.filter(...))

sessionStore (Zustand)
  └─ knownSessions: Record<sessionId, isActive>
  └─ activeSubagents: Record<sessionId, ActiveSubagent[]>
  └─ openTabs[].resolvedSessionId — links fake tab ID to real Claude UUID

UI
  └─ SessionsList: green pulsing dot when live, ⚡N badge for subagents
  └─ TeamsPanel / InboxPanel: filter to teams matching active session's leadSessionId
```

### Tab ↔ session linking

PTY tabs are created with a fake ID (`session-{timestamp}`) and `spawnedAt = Date.now()`.
When a `SessionStart` hook fires, the frontend matches by `cwd` + recency (within 30s)
to link `tab.resolvedSessionId = event.session_id`. Resume case matches by `sessionId` directly.

### Hook setup

Hooks are written into `~/.claude/settings.json` under the `hooks` key by `cmd_setup_hooks`.
The command is an inline PowerShell snippet using `$env:USERPROFILE` (no hardcoded username).
All 5 hook events (SessionStart/End, SubagentStart/Stop, Stop) are set to `async: true`
so they never block Claude CLI execution.
