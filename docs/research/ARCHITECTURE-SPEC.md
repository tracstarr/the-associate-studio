# Claude IDE — Definitive Architecture
**Version**: 1.0 | **Date**: 2026-02-21 | **Status**: Approved for Implementation

---

## Project Vision

A lightweight Windows IDE where **Claude Code CLI is the centerpiece**. Every workflow flows through Claude. Users manage multiple Claude CLI sessions across projects simultaneously, with rich visibility into teams, agents, inboxes, plans, git, and issues — all in a single window.

---

## User Decisions (Locked)

| Decision | Choice |
|----------|--------|
| UI Type | Windowed GUI (Tauri v2 + React) |
| Foundation | Start Fresh |
| Window Style | Custom Frameless + Custom Titlebar |
| Multi-Project | Single Window, Multi-Tab (sessions sidebar groups projects) |
| Code Editor | Full Monaco Editor |
| System Tray | No - standard minimize |

---

## Technology Stack

### Frontend
| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 6.x | Build tool + HMR |
| Tailwind CSS v4 | 4.x | Styling (CSS-first config) |
| shadcn/ui | Latest | Component library (Radix-based) |
| react-resizable-panels | 4.6.x | IDE split panels |
| @xterm/xterm | 6.x | Terminal emulator |
| @xterm/addon-fit | Latest | Terminal auto-resize |
| @xterm/addon-web-links | Latest | Clickable URLs in terminal |
| @xterm/addon-search | Latest | In-terminal search |
| tauri-pty | 0.1.x | PTY ↔ xterm.js bridge |
| zustand | 5.x | Client state management |
| @tanstack/react-query | 5.x | Async data + caching |
| @tanstack/react-virtual | 3.x | List virtualization |
| cmdk | 1.x | Command palette |
| @monaco-editor/react | Latest | Code editor + diff viewer |
| lucide-react | Latest | Icons |

### Backend (Rust via Tauri)
| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2.10.x | App framework |
| tauri-plugin-shell | 2.3.x | Shell commands (git, gh) |
| tauri-plugin-fs | 2.4.x | File system access |
| tauri-plugin-store | 2.4.x | Persistent settings |
| tauri-plugin-pty | 0.1.x | PTY management (portable-pty) |
| portable-pty | 0.9.x | Windows ConPTY support |
| tokio | 1.x | Async runtime |
| serde + serde_json | 1.x | JSON serialization |
| git2 | 0.20.x | Git operations (libgit2) |
| notify | 8.2.x | File system watching |
| anyhow | 1.x | Error handling |
| chrono | 0.4.x | DateTime handling |

---

## Application Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  🤖 Claude IDE  [my-project > session1]          [─] [□] [✕]          │  ← Custom titlebar (36px)
├──┬─────────────────────────────────────────────────────────────────────┤
│  │ [Tabs: session1* | session2 | +]                                    │  ← Tab bar (36px)
│AB│─────────────────────────────────────────────────────────────────────│
│  │                                                                     │
│  │  SIDEBAR (240px)  │  MAIN CONTENT AREA         │  RIGHT PANEL(320px)│
│  │  ───────────────  │  ─────────────────          │  ─────────────────│
│  │                   │                             │                   │
│  │  Projects tree    │  xterm.js Terminal          │  Context Tabs:    │
│  │  ▶ my-project     │  (Claude CLI session)        │  Context│Teams│   │
│  │    ● session1*    │                             │  Inbox│Plans      │
│  │    ○ session2     │                             │                   │
│  │  ▶ api-service    │                             │  [active content] │
│  │    ● session3     │                             │                   │
│  │                   │                             │                   │
│  │  [+ New Session]  │                             │                   │
│  │                   │─────────────────────────────│                   │
│  │                   │  BOTTOM PANEL (200px)        │                   │
│  │                   │  Git │ PRs │ Issues │ Output  │                   │
│  │                   │  [panel content]             │                   │
├──┴───────────────────┴──────────────────────────────┴───────────────────┤
│  [project] [session] [branch +3~2-1] [3 agents] [2 unread] │ [todos] [Claude: running]│
└────────────────────────────────────────────────────────────────────────┘
     ↑ Status Bar (24px)
```

### Regions
| Region | Width/Height | Collapsible | Default |
|--------|-------------|-------------|---------|
| Custom Titlebar | 36px fixed | No | Always visible |
| Activity Bar (AB) | 48px fixed | No | Always visible |
| Sidebar (SB) | 240px | Yes (Ctrl+B) | Open |
| Tab Bar | 36px fixed | No | Always visible |
| Main Content | Flexible | No | Always visible |
| Right Panel | 320px | Yes (Ctrl+Shift+B) | Open |
| Bottom Panel | 200px | Yes (Ctrl+J) | Closed |
| Status Bar | 24px fixed | No | Always visible |

---

## Component Architecture

```
src/
├── App.tsx                        # Root: QueryClient, Zustand providers
├── components/
│   ├── shell/
│   │   ├── TitleBar.tsx           # Custom frameless titlebar (drag, min/max/close)
│   │   ├── ActivityBar.tsx        # 48px left icon strip
│   │   ├── StatusBar.tsx          # 24px bottom bar
│   │   └── CommandPalette.tsx     # cmdk modal overlay
│   ├── layout/
│   │   ├── IDELayout.tsx          # react-resizable-panels root
│   │   ├── Sidebar.tsx            # Left collapsible panel
│   │   ├── MainArea.tsx           # Center: TabBar + ContentArea + BottomPanel
│   │   ├── RightPanel.tsx         # Right collapsible panel
│   │   └── BottomPanel.tsx        # Bottom: Git/PRs/Issues/Output tabs
│   ├── sessions/
│   │   ├── SessionTree.tsx        # Project tree with session entries
│   │   ├── SessionItem.tsx        # Individual session node
│   │   ├── TabBar.tsx             # Top tab strip for open sessions
│   │   └── NewSessionDialog.tsx   # Project picker + session spawn
│   ├── terminal/
│   │   ├── TerminalPane.tsx       # xterm.js instance wrapper
│   │   └── useTerminal.ts         # PTY lifecycle hook
│   ├── editor/
│   │   ├── EditorPane.tsx         # Monaco editor instance
│   │   └── DiffPane.tsx           # Monaco DiffEditor
│   ├── context/
│   │   ├── ContextPanel.tsx       # Tab switcher (Context/Teams/Inbox/Plans)
│   │   ├── ContextView.tsx        # Plan + tool calls + thinking
│   │   ├── TeamsView.tsx          # Teams + agents list
│   │   ├── InboxView.tsx          # Messages + compose
│   │   └── PlansView.tsx          # Active plans list
│   ├── git/
│   │   ├── GitPanel.tsx           # Status + diff tabs
│   │   ├── GitFileList.tsx        # Staged/unstaged/untracked
│   │   └── DiffViewer.tsx         # Inline diff with Monaco
│   └── issues/
│       ├── IssuesPanel.tsx        # Tab: PRs | Issues
│       ├── GitHubView.tsx         # GitHub PRs + Issues (via gh CLI)
│       ├── LinearView.tsx         # Linear issues
│       └── JiraView.tsx           # Jira issues
├── stores/
│   ├── sessionStore.ts            # Sessions, active session, projects
│   ├── uiStore.ts                 # Panel state, active tabs, layout
│   └── settingsStore.ts           # Font size, theme, keybindings
├── hooks/
│   ├── useClaudeData.ts           # TanStack Query hooks for backend
│   ├── useKeyBindings.ts          # Global keyboard shortcut system
│   ├── useFileWatcher.ts          # Tauri event subscriptions
│   └── useTerminal.ts             # xterm.js lifecycle
└── lib/
    ├── tauri.ts                   # Typed invoke() wrappers
    ├── theme.ts                   # Design tokens (CSS vars)
    └── utils.ts                   # cn(), formatDate(), etc.
```

---

## Rust Backend Architecture

```
src-tauri/src/
├── main.rs                        # Tauri app builder, plugin registration
├── lib.rs                         # Command exports
├── commands/
│   ├── mod.rs
│   ├── sessions.rs                # load_sessions, get_transcript
│   ├── teams.rs                   # load_teams, load_members
│   ├── tasks.rs                   # load_tasks
│   ├── inbox.rs                   # load_inbox, send_message
│   ├── todos.rs                   # load_todos
│   ├── plans.rs                   # load_plans
│   ├── pty.rs                     # spawn_session, write_pty, kill_pty
│   ├── git.rs                     # git_status, git_diff, git_branches
│   └── issues.rs                  # gh_prs, gh_issues, linear, jira
├── data/                          # Data parsers (ported from associate)
│   ├── mod.rs
│   ├── sessions.rs
│   ├── teams.rs
│   ├── inboxes.rs
│   ├── transcripts.rs
│   ├── plans.rs
│   ├── todos.rs
│   ├── tasks.rs
│   ├── git.rs
│   └── path_encoding.rs
├── models/                        # Serde structs
│   ├── mod.rs
│   ├── session.rs
│   ├── team.rs
│   ├── inbox.rs
│   ├── transcript.rs
│   ├── git.rs
│   ├── plan.rs
│   ├── task.rs
│   └── todo.rs
├── pty/
│   ├── mod.rs
│   └── manager.rs                 # PTY pool: spawn, write, kill, resize
└── watcher/
    ├── mod.rs
    └── claude_watcher.rs          # notify-based watcher → Tauri events
```

---

## Data Flow

### PTY Terminal Session
```
User spawns session (project_dir selected)
  → invoke("spawn_session", { project_dir, resume_id? })
  → Rust: portable-pty spawn "claude" in project_dir (ConPTY)
  → PTY stdout → Tauri event "pty-output" { id, data: Uint8Array }
  → xterm.js terminal.write(data)

User types in terminal
  → xterm.js onData(data)
  → invoke("write_pty", { id, data })
  → Rust: PTY stdin write
```

### Real-Time File Watching
```
~/.claude/ file changes
  → notify crate (ReadDirectoryChangesW)
  → debounce (100-500ms per category)
  → Tauri emit event to frontend:
      "inbox-changed"    → refetch inbox data
      "team-changed"     → refetch teams data
      "task-changed"     → refetch tasks data
      "session-changed"  → refetch sessions list
      "transcript-updated" { offset } → incremental transcript read
```

### Session Auto-Switch
```
User clicks session in SessionTree
  → sessionStore.setActiveSession(id)
  → Terminal pane switches to that session's PTY
  → ContextPanel refetches: plan, tool calls, thinking for session
  → TeamsView refetches: teams matching session's CWD
  → GitPanel refetches: git status for session's CWD
  → StatusBar updates all items
```

### Inbox Message Send
```
User composes message in InboxView
  → invoke("send_inbox_message", { team, agent, message })
  → Rust: read ~/.claude/teams/{team}/inboxes/{agent}.json
  → Append message, atomic write (temp → rename)
  → notify watcher fires "inbox-changed"
  → UI refreshes
```

---

## Keybinding System

### Global
| Key | Action |
|-----|--------|
| `Ctrl+P` | Command Palette |
| `Ctrl+Shift+P` | Command Palette (command mode `>`) |
| `Ctrl+B` | Toggle Sidebar |
| `Ctrl+Shift+B` | Toggle Right Panel |
| `Ctrl+J` | Toggle Bottom Panel |
| `Ctrl+` ` | Focus Terminal |
| `Ctrl+Shift+F` | Full Terminal Mode (hide all panels) |
| `Ctrl+N` | New Session |
| `Ctrl+,` | Settings |
| `F1` | Help |

### Activity Bar / Panel Switching
| Key | Action |
|-----|--------|
| `Ctrl+1` | Sessions panel |
| `Ctrl+2` | Teams panel |
| `Ctrl+3` | Inbox panel |
| `Ctrl+4` | Git panel |
| `Ctrl+5` | PR/Issues panel |

### Session Tabs
| Key | Action |
|-----|--------|
| `Ctrl+Tab` | Next session tab |
| `Ctrl+Shift+Tab` | Previous session tab |
| `Ctrl+W` | Close session tab |
| `Alt+1..9` | Jump to tab N |

### Terminal
| Key | Action |
|-----|--------|
| `Ctrl+Shift+C` | Copy selection |
| `Ctrl+Shift+V` | Paste |
| `Ctrl+L` | Clear terminal |
| `Ctrl+F` | Find in terminal |
| `Ctrl+Home/End` | Scroll to top/bottom |

---

## Color System (Dark Theme)

```css
/* Background layers */
--bg-base: #0D1117;         /* App background */
--bg-surface: #161B22;      /* Panel backgrounds */
--bg-raised: #1C2128;       /* Cards, command palette */
--bg-overlay: #21262D;      /* Tooltips, hover states */
--bg-terminal: #0A0E14;     /* Terminal (slightly darker) */

/* Text */
--text-primary: #E6EDF3;
--text-secondary: #8B949E;
--text-muted: #484F58;

/* Accent */
--accent-primary: #58A6FF;    /* Links, focus, active */
--accent-secondary: #BC8CFF; /* Claude-related highlights */

/* Status */
--status-success: #3FB950;   /* Running, active */
--status-error: #F85149;     /* Error, failing */
--status-warning: #D29922;   /* Idle, pending */

/* Git diff */
--diff-add-bg: #12261E;
--diff-remove-bg: #2D1215;
```

---

## Implementation Phases

### Phase 1: Foundation (Tauri Shell + Layout)
- Create Tauri v2 + React + TS project with Vite
- Set up Tailwind v4 + shadcn/ui + design tokens
- Custom frameless window + custom titlebar
- IDELayout with react-resizable-panels (sidebar, main, right, bottom)
- Activity bar (icons only, no content yet)
- Basic tab bar (session tabs)
- Status bar (placeholder items)
- Dark theme implementation

### Phase 2: Claude Data Layer (Rust Backend)
- Port ALL data models from associate project
- Path encoding utility
- File watcher (notify) → Tauri events
- Tauri commands: sessions, teams, tasks, inbox, todos, plans
- TypeScript typed invoke() wrappers
- TanStack Query hooks for all data types

### Phase 3: Terminal Integration
- Set up tauri-plugin-pty
- PTY manager (spawn, write, kill, resize)
- xterm.js TerminalPane component
- PTY I/O Tauri event bridge
- Session spawn via project picker
- Terminal tab management

### Phase 4: Sessions & Context Panels
- SessionTree in sidebar (projects grouped, sessions nested)
- ContextPanel (plan, tool calls, thinking display)
- TeamsView (agents with status colors)
- InboxView (messages + compose)
- PlansView (markdown plans)
- Auto-switch all panels on session selection

### Phase 5: Git Integration
- git2 backend: status, diff, log, branches
- GitPanel in bottom panel
- GitFileList (staged/unstaged/untracked)
- DiffViewer with Monaco DiffEditor
- Context-aware: switches when session changes
- Branch in status bar

### Phase 6: PR/Issues Integration
- gh CLI integration (PRs, Issues via shell commands)
- Linear issues (REST API)
- Jira issues (acli or REST)
- IssuesPanel tab switching
- PR detail view

### Phase 7: Monaco + Command Palette
- Monaco editor for file viewing
- Monaco DiffEditor for git diffs
- Command palette (cmdk) with all commands
- Full keybinding system with useKeyBindings hook
- Panel focus management

### Phase 8: Polish
- Settings panel (font size, theme, keybindings)
- Error boundaries + graceful degradation
- Memory optimization (xterm.js disposal, transcript capping)
- Performance profiling
- Help overlay / onboarding

---

## Memory Budget

| Component | Estimated RAM |
|-----------|--------------|
| Tauri Rust backend | 15-25 MB |
| WebView2 (React app) | 80-120 MB |
| xterm.js per terminal (scrollback 5000) | 10-30 MB |
| PTY process (claude CLI) | 30-50 MB each |
| Monaco editor (lazy loaded) | 20-40 MB (when open) |
| **Total (2 sessions, editor open)** | **~250-350 MB** |

### Optimization Rules
1. `scrollback: 5000` for all xterm.js terminals
2. Always `dispose()` terminals on unmount
3. Transcript cap: 5000 items max
4. Monaco lazy-loaded (only when diff/file tab opened)
5. `@tanstack/react-virtual` for all long lists
6. File watchers scoped to active projects only
7. PTY reader threads killed when session closed

---

## Project Structure (Final)

```
/c/dev/ide/
├── src/                           # React frontend
├── src-tauri/                     # Rust backend
├── research/                      # Research docs (reference)
├── ARCHITECTURE.md                # This file
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.css                   # Tailwind v4 CSS-first config
├── components.json                # shadcn/ui config
└── .gitignore
```
