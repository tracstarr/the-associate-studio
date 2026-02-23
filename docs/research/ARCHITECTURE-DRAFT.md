# Claude IDE — Architecture Draft
**Status**: Draft (pending agent research completion)
**Date**: 2026-02-21

---

## 1. Vision

A lightweight Windows-native IDE where **Claude Code CLI is the centerpiece**.
Every workflow flows through Claude: spawn sessions, monitor teams, read transcripts, send messages, view git, browse issues — all without leaving the IDE.

---

## 2. Technology Stack

### Finalized Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| App Shell | **Tauri v2** | ~5MB binary, uses OS WebView2 (no bundled Chromium), Rust backend |
| Backend | **Rust** | Memory safety, zero-cost abstractions, PTY support, file watching |
| Frontend | **React 18 + TypeScript** | Familiar ecosystem, excellent IDE layout libs |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Headless components, IDE-appropriate dark theme |
| Terminal | **xterm.js v5 + @xterm/addon-fit** | Industry standard, handles ANSI codes, VT sequences |
| PTY | **portable-pty (Rust)** | Cross-platform PTY, Windows ConPTY support |
| Panels | **react-resizable-panels** | Lightweight, performant splitter panels |
| State | **Zustand** | Minimal, fast, no boilerplate for IDE state |
| Async Data | **TanStack Query v5** | Polling/caching for backend data |
| Command Palette | **cmdk** | Fast command palette component |
| List Virtualization | **@tanstack/react-virtual** | Required for long transcript/agent lists |
| Build | **Vite 6** | Fast HMR, excellent Tauri integration |
| Git | **git CLI via Tauri shell** | Simpler than git2-rs, avoids libgit2 linking issues on Windows |
| File Watching | **notify crate (Rust)** | Debounced file system events for ~/.claude/ |

### What We're NOT Using
- Electron (too heavy, 200-500MB RAM)
- Monaco Editor (8MB+ bundle for features we don't need)
- Redux (overkill for this use case)
- libgit2/git2-rs (linking complexity on Windows)
- node-pty (Node.js PTY — we use Rust-side PTY instead)

---

## 3. Application Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Claude IDE (Tauri App Window)                   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                         React Frontend                        │  │
│  │                                                               │  │
│  │  ┌──────────┐  ┌─────────────────────────┐  ┌────────────┐  │  │
│  │  │ Sessions  │  │   Main Content Area      │  │  Right     │  │  │
│  │  │ Sidebar   │  │                          │  │  Panel     │  │  │
│  │  │           │  │  ┌───────────────────┐   │  │            │  │  │
│  │  │ • proj1 ◀ │  │  │  xterm.js Terminal│   │  │ Teams/     │  │  │
│  │  │ • proj2   │  │  │  (Claude CLI)     │   │  │ Agents     │  │  │
│  │  │ • proj3   │  │  │                   │   │  │            │  │  │
│  │  │           │  │  └───────────────────┘   │  │ Inbox      │  │  │
│  │  │ [+] New   │  │                          │  │            │  │  │
│  │  └──────────┘  │  ┌───────────────────┐   │  │ Plans      │  │  │
│  │                │  │  Context Panel     │   │  │            │  │  │
│  │                │  │  (Plan/Todos/Tools)│   │  └────────────┘  │  │
│  │                │  └───────────────────┘   │                   │  │
│  │                └─────────────────────────┘                   │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ Bottom Panel (Git / PRs / Issues — tabbed)            │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ Status Bar  [session] [branch] [agents] [git±]       │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Tauri Rust Backend                          │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐  │  │
│  │  │ PTY Manager  │  │ FileWatcher│  │ Data Parsers         │  │  │
│  │  │             │  │            │  │                      │  │  │
│  │  │ spawn_session│  │ watch_     │  │ sessions.rs          │  │  │
│  │  │ write_stdin  │  │ claude_dir │  │ teams.rs             │  │  │
│  │  │ kill_session │  │ watch_git  │  │ inboxes.rs           │  │  │
│  │  │             │  │            │  │ transcripts.rs        │  │  │
│  │  └─────────────┘  └────────────┘  │ git.rs               │  │  │
│  │                                   │ plans.rs             │  │  │
│  │  ┌─────────────────────────────┐  └──────────────────────┘  │  │
│  │  │ Tauri IPC Commands          │                            │  │
│  │  │                             │  ┌──────────────────────┐  │  │
│  │  │ #[tauri::command]           │  │ External Processes    │  │  │
│  │  │ - get_sessions()            │  │                      │  │  │
│  │  │ - get_teams()               │  │ git CLI              │  │  │
│  │  │ - get_inbox()               │  │ gh CLI               │  │  │
│  │  │ - send_message()            │  │ acli (Jira)          │  │  │
│  │  │ - spawn_session()           │  │ linear CLI           │  │  │
│  │  │ - write_to_pty()            │  └──────────────────────┘  │  │
│  │  │ - get_git_status()          │                            │  │
│  │  │ - get_diff()                │                            │  │
│  │  └─────────────────────────────┘                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Rust Backend Modules

```
src-tauri/
├── src/
│   ├── main.rs              # Entry point, app initialization
│   ├── commands/            # Tauri IPC commands
│   │   ├── mod.rs
│   │   ├── sessions.rs      # Session CRUD, transcript reading
│   │   ├── teams.rs         # Team/agent data
│   │   ├── inbox.rs         # Inbox read/write
│   │   ├── git.rs           # Git status/diff (shell commands)
│   │   ├── issues.rs        # GitHub/Jira/Linear
│   │   ├── pty.rs           # PTY spawning and I/O
│   │   └── projects.rs      # Project management
│   ├── data/                # Data layer (ported from associate)
│   │   ├── mod.rs
│   │   ├── sessions.rs
│   │   ├── teams.rs
│   │   ├── inboxes.rs
│   │   ├── transcripts.rs
│   │   ├── plans.rs
│   │   ├── todos.rs
│   │   ├── tasks.rs
│   │   ├── git.rs
│   │   └── path_encoding.rs
│   ├── models/              # Data types (serde structs)
│   │   ├── mod.rs
│   │   ├── session.rs
│   │   ├── team.rs
│   │   ├── inbox.rs
│   │   ├── transcript.rs
│   │   ├── git.rs
│   │   └── plan.rs
│   ├── pty/                 # PTY management
│   │   ├── mod.rs
│   │   ├── manager.rs       # PTY pool, session tracking
│   │   └── windows.rs       # Windows ConPTY specifics
│   └── watcher/             # File system watchers
│       ├── mod.rs
│       ├── claude_watcher.rs # Watches ~/.claude/ for changes
│       └── git_watcher.rs    # Watches project dirs for git changes
```

---

## 5. React Frontend Structure

```
src/
├── App.tsx                   # Root component, layout
├── components/
│   ├── layout/
│   │   ├── IDELayout.tsx     # Main panel layout (react-resizable-panels)
│   │   ├── ActivityBar.tsx   # Left icon bar (à la VS Code)
│   │   ├── StatusBar.tsx     # Bottom status bar
│   │   └── CommandPalette.tsx # cmdk command palette
│   ├── sessions/
│   │   ├── SessionsList.tsx  # Left sidebar session list
│   │   ├── SessionItem.tsx   # Individual session entry
│   │   └── NewSessionModal.tsx
│   ├── terminal/
│   │   ├── TerminalPane.tsx  # xterm.js wrapper
│   │   ├── TerminalTabs.tsx  # Multiple terminal tabs per project
│   │   └── useTerminal.ts    # Terminal lifecycle hook
│   ├── context/
│   │   ├── ContextPanel.tsx  # Right panel content switcher
│   │   ├── TeamsView.tsx     # Team/agent status display
│   │   ├── InboxView.tsx     # Agent inbox + compose
│   │   ├── PlansView.tsx     # Active plans display
│   │   └── TranscriptView.tsx # Session transcript/thinking
│   ├── git/
│   │   ├── GitPanel.tsx      # Bottom panel: git status
│   │   ├── GitFileList.tsx   # Staged/unstaged/untracked
│   │   └── DiffViewer.tsx    # Unified diff display
│   └── issues/
│       ├── IssuesPanel.tsx   # Bottom panel: PRs/Issues
│       ├── GitHubView.tsx
│       ├── LinearView.tsx
│       └── JiraView.tsx
├── stores/
│   ├── sessionStore.ts       # Zustand: active sessions, selected
│   ├── uiStore.ts            # Zustand: panel state, keybindings
│   └── settingsStore.ts      # Zustand: user preferences
├── hooks/
│   ├── useClaudeData.ts      # TanStack Query hooks for backend data
│   ├── useFileWatcher.ts     # Subscribe to Tauri file change events
│   ├── useKeyBindings.ts     # Global keyboard shortcut handler
│   └── useTerminal.ts        # xterm.js lifecycle management
└── lib/
    ├── tauri.ts              # Typed Tauri command wrappers
    └── theme.ts              # Color tokens, design system
```

---

## 6. Data Flow

### Real-time Updates (File Watcher)
```
~/.claude/ changes
    → notify crate (Rust)
    → debounce 200ms
    → Tauri emit("claude-data-changed", { type, path })
    → React useFileWatcher hook
    → Zustand store update
    → Component re-render
```

### PTY Terminal Session
```
User selects project in Sessions Sidebar
    → invoke("spawn_session", { project_dir, session_id? })
    → Rust: portable-pty spawn claude CLI
    → PTY stdout → Tauri emit("pty-data", { id, data })
    → xterm.js terminal.write(data)

User types in terminal
    → xterm.js onData
    → invoke("write_to_pty", { id, data })
    → Rust: write to PTY stdin
```

### Inbox Message Send
```
User types message in InboxView
    → invoke("send_message", { team, agent, message })
    → Rust: write JSON to ~/.claude/teams/{team}/inboxes/{agent}.json
    → File watcher detects change
    → Inbox view refreshes
```

---

## 7. Key Design Decisions

### A. PTY vs Subprocess
We spawn claude CLI in a proper PTY (using `portable-pty` crate + Windows ConPTY).
This gives us real interactive terminal behavior — colors, cursor control, prompts.
The alternative (subprocess with piped stdout) breaks interactive Claude behavior.

### B. Real-time via Events not Polling
File watchers emit Tauri events → React subscriptions.
Polling is only used for things that can't be watched (GitHub API, Linear API).
TanStack Query handles polling with proper cache invalidation.

### C. Session Context Auto-switching
When user selects a session in the Sessions Sidebar:
- Git panel updates to show that project's git status
- Context panel updates to show that session's team/agents
- Inbox updates to show relevant team's messages

### D. Multiple Project Support
The IDE tracks multiple "workspaces" — each workspace is a project directory.
Each project can have 1+ Claude CLI sessions (PTY instances).
The Sessions Sidebar groups sessions by project.

### E. Memory Management
- xterm.js terminals have a `scrollback: 5000` limit
- Transcript items are capped (5000 items, same as associate)
- PTY processes are tracked and killed when tabs close
- File watchers are scoped to active projects
- TanStack Query has `staleTime` and `gcTime` configured

---

## 8. Keybinding Scheme (Draft)

### Global
| Key | Action |
|-----|--------|
| `Ctrl+P` | Command Palette |
| `Ctrl+1` | Focus Sessions Sidebar |
| `Ctrl+2` | Focus Terminal |
| `Ctrl+3` | Focus Context Panel (Teams/Inbox/Plans) |
| `Ctrl+4` | Focus Bottom Panel (Git/Issues) |
| `Ctrl+B` | Toggle Sessions Sidebar |
| `Ctrl+J` | Toggle Bottom Panel |
| `Ctrl+K` | Toggle Right Panel |
| `Ctrl+Shift+P` | Command Palette (alt) |
| `Ctrl+N` | New Session |
| `F1` | Help / Keybindings |

### Sessions Sidebar
| Key | Action |
|-----|--------|
| `↑/↓` | Navigate sessions |
| `Enter` | Open session in terminal |
| `Del` | (future) Archive session |
| `Ctrl+F` | Filter sessions |

### Terminal
| Key | Action |
|-----|--------|
| `Ctrl+C` | Send interrupt |
| `Ctrl+L` | Clear terminal |
| `Ctrl+Shift+C` | Copy selection |
| `Ctrl+Shift+V` | Paste |
| `Ctrl+F` | Find in terminal |
| `Ctrl+Tab` | Next terminal tab |
| `Ctrl+Shift+Tab` | Prev terminal tab |

### Context Panel
| Key | Action |
|-----|--------|
| `T` | Switch to Teams tab |
| `I` | Switch to Inbox tab |
| `P` | Switch to Plans tab |
| `↑/↓` | Navigate in panel |
| `Enter` | Select / expand item |
| `M` | Compose message (in Inbox) |
| `Escape` | Cancel compose / close |

### Bottom Panel (Git)
| Key | Action |
|-----|--------|
| `G` | Switch to Git tab |
| `R` | Switch to PRs tab |
| `S` | Switch to Issues tab |
| `↑/↓` | Navigate files/items |
| `Enter` | View diff / open issue |
| `Tab` | Switch between Staged/Unstaged panes |

---

## 9. UI Layout Panels

### Panel Sizes (defaults, user-resizable)
```
┌──────────────────────────────────────────────────────────┐
│ [Activity Bar 48px] [Sidebar 280px] [Main] [Right 320px] │
│                                                           │
│                         [Bottom Panel 200px]              │
│                         [Status Bar 24px]                 │
└──────────────────────────────────────────────────────────┘
```

### Activity Bar Icons (left strip)
1. Sessions list
2. Teams & Agents
3. Git
4. Issues/PRs
5. Settings

### Right Panel Tabs
- Teams (active agents, status)
- Inbox (messages + compose)
- Plans (current plans)

### Bottom Panel Tabs
- Git (status + diff)
- PRs (GitHub pull requests)
- Issues (GitHub/Linear/Jira)

---

## 10. Project Structure (Root)

```
/c/dev/ide/
├── src/                     # React frontend
├── src-tauri/               # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── components.json          # shadcn/ui config
└── research/                # Research docs (this dir)
```

---

## 11. Open Questions (for agents to answer)

1. **Tauri v2 PTY**: Can portable-pty work with Tauri v2's async runtime? Or do we need portabledpty in a separate thread?
2. **xterm.js event bridge**: Best way to bridge PTY stdout (Rust) → xterm.js with minimal latency? Binary vs base64?
3. **shadcn/ui vs Radix directly**: Do we need full shadcn or just Radix primitives?
4. **Monaco for diffs**: Too heavy? Or use a simpler diff renderer (custom component)?
5. **GitHub auth**: How to handle GitHub CLI (gh) auth in Tauri context?
6. **Linear API**: REST vs GraphQL? Do they have a good TypeScript SDK?
7. **Windows ConPTY**: Any known issues with Tauri + ConPTY on Windows 11?

---

*This is a living document — research agents will fill in specifics.*
