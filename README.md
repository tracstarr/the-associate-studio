# The Associate Studio

A lightweight Windows desktop IDE built around **Claude Code CLI** as the centerpiece. Run multiple Claude sessions, track live agent activity, browse git history, manage PRs and issues — all in a single native window with no Electron overhead.

Built with Tauri v2 (Rust backend) + React 19.

---

## Features

### Claude CLI Sessions
- Open unlimited Claude Code sessions as tabs, each backed by a real Windows **ConPTY** terminal
- Sessions are never killed when switching tabs — hidden with CSS, never unmounted
- Live session detection via Claude CLI hooks: green pulsing dot for active sessions, ⚡N badge for running subagents
- Hooks auto-configure on launch (idempotent) — no manual setup required

### Multi-Project Workspace
- Switch between projects with a project switcher in the sidebar
- Per-project tab sets — tabs are scoped to the active project directory
- Native folder picker (rfd) for adding project directories

### Git Integration
- Live branch name in the status bar (git2 crate — no `git` CLI required)
- Git status panel with changed file list
- Diff viewer for inspecting changes

### PRs & Issues
- PR and Issue panels powered by the `gh` CLI
- Supports GitHub OAuth device flow or personal access token
- Linear and Jira issue panels (API key / token auth)

### Teams & Agent Visibility
- Teams panel shows Claude agent teams from `~/.claude/teams/`
- Inbox panel for inter-agent messages
- Plans panel for `~/.claude/plans/` markdown files
- Filtered to the active session's lead agent

### Command Palette
- 25+ commands accessible via `Ctrl+P` with fuzzy search
- Categories: View, Session, Settings

### Settings
- Appearance: font family, font size
- Integrations: GitHub (OAuth device flow or PAT), Linear (API key), Jira (API token + base URL + email)
- Session hooks: enable/disable live session tracking
- All secrets stored in **Windows Credential Manager** — never in plain JSON files

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude IDE  /  project-name                    [─] [□] [✕]    │  TitleBar
├──┬──────────────────────────────────────────────────────────────┤
│  │ [Tabs: New Session ×  session2  +]                           │  TabBar
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
│  [branch] [sessions] [agents] [unread]         [todos] [status]│  StatusBar
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Library | Version | Role |
|---------|---------|------|
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 6.x | Build tool + HMR |
| Tailwind v4 | 4.x | CSS-first styling with CSS variable design tokens |
| xterm.js | 5.x | Terminal emulator |
| react-resizable-panels | 2.x | Resizable IDE layout |
| Zustand | 5.x | Synchronous UI state |
| TanStack Query | 5.x | Async data fetching + caching |
| cmdk | 1.x | Command palette |
| lucide-react | latest | Icons |

### Backend (Rust)
| Crate | Role |
|-------|------|
| tauri 2.x | Native window + WebView2 bridge |
| portable-pty 0.8.x | Windows ConPTY for real TTY sessions |
| notify 8.x | File system watcher (`~/.claude/` live updates) |
| git2 0.20.x | Git status + diff (no `git` CLI needed) |
| keyring 3.x | Windows Credential Manager for secrets |
| reqwest 0.12.x | HTTP client for GitHub / Linear / Jira APIs |
| serde + serde_json | JSON serialization for all data models |
| rfd 0.14.x | Native folder picker dialog |

---

## Prerequisites

- **Windows 10/11** (x86-64)
- **Node.js 20.x** + **npm 10.x**
- **Rust 1.83+** with the `stable-x86_64-pc-windows-gnu` target
- **MSYS2 + MinGW-w64** at `C:/msys64/`
- **Claude Code CLI** installed and on PATH
- **gh CLI** (optional — required for PR/Issue panels)

### First-time Rust toolchain setup

```bash
# Install rustup (if not already installed)
winget install Rustlang.Rustup

# Install the GNU target
rustup toolchain install stable-x86_64-pc-windows-gnu
rustup default stable-x86_64-pc-windows-gnu

# Install MSYS2
winget install MSYS2.MSYS2

# In the MSYS2 shell, install MinGW GCC
pacman -S mingw-w64-x86_64-gcc
```

---

## Installation

```bash
git clone <repo-url>
cd ide
npm install
```

---

## Running

The PATH must include MSYS2 MinGW binaries before any Rust build. Set this once per terminal session:

```bash
export PATH="/c/msys64/mingw64/bin:$HOME/.cargo/bin:$PATH"
export PKG_CONFIG_PATH="/c/msys64/mingw64/lib/pkgconfig"
```

### Development (hot reload)

```bash
npm run tauri dev
```

- TypeScript/React changes reload instantly via Vite HMR
- Rust changes trigger a cargo rebuild (~15–30s incremental)

### Frontend preview only (no native window)

```bash
npm run dev
# Opens http://localhost:1420 in the browser
```

### Release build

```bash
npm run tauri build
# Outputs .exe + installer to src-tauri/target/release/bundle/
```

### Rust-only build check

```bash
cargo build --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-gnu
```

> **Cold build time**: ~4–6 minutes (libgit2, reqwest, and tauri-runtime-wry compile from source on first build). Incremental builds are 15–30 seconds.

---

## Keybindings

### Global

| Key | Action |
|-----|--------|
| `Ctrl+P` | Open command palette |
| `Ctrl+,` | Open settings |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+Shift+B` | Toggle right panel |
| `Ctrl+J` | Toggle bottom panel |
| `Ctrl+N` | New Claude session |
| `Ctrl+W` | Close active tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |

### Sidebar views

| Key | View |
|-----|------|
| `Ctrl+1` | Projects & Sessions |
| `Ctrl+2` | Git |
| `Ctrl+3` | PRs / Issues |

### Font size

| Key | Action |
|-----|--------|
| `Ctrl+=` | Increase |
| `Ctrl+-` | Decrease |
| `Ctrl+0` | Reset |

### Bottom panel

| Key | Action |
|-----|--------|
| `Ctrl+Shift+G` | Open Git panel |

> **Note**: When a terminal tab is focused, keystrokes go to xterm.js. `Ctrl+C` sends SIGINT to Claude — use `Ctrl+Shift+C` to copy terminal selection.

---

## Integrations Setup

### GitHub

1. Create a GitHub OAuth App at `github.com → Settings → Developer Settings → OAuth Apps`
2. Enable the "Device Flow" checkbox
3. In the IDE: **Settings → Integrations → GitHub** → paste the Client ID → click "Connect"
4. A code will appear — enter it at `github.com/login/device`

Alternatively, use a Personal Access Token (`repo` + `read:org` scopes).

### Linear

1. Create an API key at `linear.app/settings/api`
2. In the IDE: **Settings → Integrations → Linear** → paste the key

### Jira

1. Create an API token at `id.atlassian.net/manage-profile/security/api-tokens`
2. In the IDE: **Settings → Integrations → Jira** → enter your base URL, email, and token

> All tokens are stored in **Windows Credential Manager** (DPAPI-encrypted), never in plain files.

---

## Project Structure

```
ide/
├── src/                        # React frontend
│   ├── App.tsx                 # Root — loads settings, mounts IDEShell
│   ├── components/
│   │   ├── shell/              # TitleBar, ActivityBar, StatusBar, CommandPalette, SettingsPanel
│   │   ├── layout/             # IDELayout, Sidebar, MainArea, BottomPanel
│   │   ├── terminal/           # TerminalView (xterm.js + PTY)
│   │   ├── sessions/           # SessionsList, TeamsPanel, InboxPanel
│   │   ├── context/            # ContextPanel, TeamsRightPanel, PlansPanel
│   │   ├── git/                # GitStatusPanel, DiffViewer
│   │   ├── issues/             # PRListPanel, IssueListPanel
│   │   └── projects/           # ProjectSwitcher
│   ├── stores/                 # uiStore, sessionStore, settingsStore, projectsStore
│   ├── hooks/                  # useKeyBindings, useClaudeData, useActiveProjectTabs
│   └── lib/                    # tauri.ts (invoke wrappers), commands.ts
├── src-tauri/
│   └── src/
│       ├── commands/           # Tauri command handlers (pty, git, issues, hooks, projects, integrations)
│       ├── data/               # Data loaders for ~/.claude/ files
│       ├── models/             # Serde structs (session, team, inbox, task, plan, git, hook_event)
│       ├── watcher/            # claude_watcher.rs — file watcher + hook event emitter
│       └── lib.rs              # Command registration
└── docs/                       # Architecture, tech stack, build, terminal, integrations, theming, keybindings
```

---

## Known Issues & Limitations

- **Windows only** — ConPTY and Windows Credential Manager are Windows-specific
- Cold Rust build is slow (~4–6 min) due to libgit2 and reqwest compiling from C/Rust source
- Main JS bundle is ~718KB (xterm.js not yet code-split into a separate chunk)
- Monaco editor is lazy-imported but not yet wired to a diff/file tab type
- TypeScript build has 4 pre-existing non-blocking warnings (unused variables)

---

## Documentation

Full documentation is in [`docs/`](docs/index.md):

| Doc | Contents |
|-----|----------|
| [Architecture](docs/architecture.md) | Component tree, data flow, hook pipeline |
| [Tech Stack](docs/tech-stack.md) | Every library chosen, with rationale and alternatives rejected |
| [Build Setup](docs/build.md) | Toolchain, PATH, build commands, known issues |
| [Terminal & PTY](docs/terminal.md) | ConPTY wiring, CLAUDECODE env var, sizing |
| [Data Formats](docs/data-formats.md) | `~/.claude/` file layout, path encoding, JSONL format |
| [Integrations](docs/integrations.md) | GitHub OAuth, Linear, Jira, Claude CLI hooks |
| [Security](docs/security.md) | Secret storage strategy |
| [Theming](docs/theming.md) | Color system, CSS variables, Tailwind v4 |
| [Keybindings](docs/keybindings.md) | Full keybinding reference + command palette |
