# Claude IDE — Agent Guide

Windows desktop IDE where **Claude Code CLI is the centerpiece**. Built with Tauri v2 (Rust) + React 19.

## Quick orientation

| What | Where |
|------|-------|
| Frontend | `src/` (React + TypeScript) |
| Backend | `src-tauri/src/` (Rust) |
| Docs index | [`docs/index.md`](docs/index.md) |

## Documentation requirement

> **After every feature change, implementation, or significant decision, update ALL relevant documentation — both Markdown (`.md`) and HTML (`.html`) files.** If no doc fits, create one and link it from `docs/index.md`.

### Mandatory: Update docs after every change

Any time you change or implement a feature, you **must** update the corresponding documentation before considering the work complete. This applies to:

- **New features** — document what was added, how it works, and how to use it
- **Modified features** — update existing docs to reflect the new behavior
- **Removed features** — remove or mark as deprecated in all docs that reference them
- **Bug fixes that change behavior** — update docs if the fix alters observable behavior
- **API or command changes** — update usage examples, parameter lists, and return types

### Both Markdown and HTML docs must stay in sync

This project may contain documentation in both **Markdown** (`.md`) and **HTML** (`.html`) formats. When updating documentation:

1. **Find all affected docs** — search for references to the changed feature in both `.md` and `.html` files
2. **Update every occurrence** — do not update one format and leave the other stale
3. **Verify consistency** — ensure Markdown and HTML docs describe the same behavior

### What counts as a significant decision

- Choosing a library/crate (or rejecting one)
- A non-obvious implementation approach (e.g., why portable-pty, why no StrictMode)
- A security choice (e.g., where a secret is stored)
- A data format gotcha discovered during implementation
- A build system quirk or workaround

Where to document:
| Topic | Doc |
|-------|-----|
| New library or crate | [`docs/tech-stack.md`](docs/tech-stack.md) — add to table + Decision Log |
| Terminal / PTY change | [`docs/terminal.md`](docs/terminal.md) |
| New integration (auth, API) | [`docs/integrations.md`](docs/integrations.md) |
| Security / secret storage | [`docs/security.md`](docs/security.md) |
| Build / toolchain issue | [`docs/build.md`](docs/build.md) |
| Data format discovery | [`docs/data-formats.md`](docs/data-formats.md) |
| Color or design change | [`docs/theming.md`](docs/theming.md) |
| New keybinding | [`docs/keybindings.md`](docs/keybindings.md) |
| Architecture change | [`docs/architecture.md`](docs/architecture.md) |

## Build (PATH must be set first)

```bash
export PATH="/c/msys64/mingw64/bin:$HOME/.cargo/bin:$PATH"
export PKG_CONFIG_PATH="/c/msys64/mingw64/lib/pkgconfig"

npm run tauri dev        # dev build + hot reload
npm run tauri build      # release build
```

## Key files — Frontend

| Area | Files | Purpose |
|------|-------|---------|
| Entry | `src/main.tsx`, `src/App.tsx` | No StrictMode; ErrorBoundary wraps IDEShell; loads settings + projects on mount |
| Stores | `src/stores/uiStore.ts` | Panel visibility, sidebar/right/bottom tab state, neural field, debug panel, `pendingNoteRef` for editor→notes handoff |
| | `src/stores/sessionStore.ts` | Per-project tabs (open/close/resume), subagent tracking, plan links (filename → session UUID) |
| | `src/stores/projectsStore.ts` | Multi-project management, active project, `pathToProjectId()` encoding |
| | `src/stores/settingsStore.ts` | Font, GitHub/Linear/Jira config; secrets via keyring, rest via `settings.json` |
| | `src/stores/notificationStore.ts` | Claude question notifications (per-tab, read/unread) |
| | `src/stores/outputStore.ts` | Output panel messages (git actions, operations log) |
| | `src/stores/debugStore.ts` | Dev-only debug log (max 500 entries) |
| Hooks | `src/hooks/useClaudeData.ts` | React Query hooks for all data (sessions, teams, tasks, inbox, git, PRs, issues, notes); `useClaudeWatcher()` listens for Tauri events |
| | `src/hooks/useKeyBindings.ts` | Global keyboard shortcuts |
| | `src/hooks/useGitAction.ts` | Wraps async git ops with output panel logging |
| | `src/hooks/useActiveProjectTabs.ts` | Derives tabs/activeTab for current project |
| Lib | `src/lib/tauri.ts` | All `invoke()` wrappers + TypeScript types for Tauri commands |
| | `src/lib/commands.ts` | Command palette entries (View, Session, Project, Settings) |
| | `src/lib/utils.ts` | `cn()` (clsx + tailwind-merge) + `pathToProjectId()` (mirrors Rust `encode_project_path`) |

## Key files — Backend (Rust)

| Area | Files | Purpose |
|------|-------|---------|
| Entry | `src-tauri/src/lib.rs` | Plugin init, PtyState, GitWatcherState, hook setup on launch, starts claude_watcher |
| Commands | `commands/pty.rs` | PTY spawn/resize/write/kill via portable-pty (ConPTY) |
| | `commands/git.rs` | git status/diff/log/branches/worktrees/fetch/pull/rebase + Claude git actions + `cmd_watch_git_head` |
| | `commands/sessions.rs` | Load session index + transcripts from `~/.claude/projects/` |
| | `commands/integrations.rs` | GitHub device flow, Linear, Jira auth; Windows Credential Manager |
| | `commands/hooks.rs` | Install/remove Claude CLI hooks in `~/.claude/theassociate/` |
| | `commands/projects.rs` | List/delete/create projects, pick folder, read/write files, run `claude --init` |
| | `commands/teams.rs` | Load/delete team configs from `~/.claude/teams/` |
| | `commands/tasks.rs` | Load tasks from `~/.claude/tasks/` |
| | `commands/inbox.rs` | Load/send team inbox messages |
| | `commands/todos.rs` | Load todo files |
| | `commands/plans.rs` | Load/read/save markdown plan files |
| | `commands/issues.rs` | List GitHub PRs, GitHub issues, and Linear issues |
| | `commands/summaries.rs` | Load/read session completion summaries |
| | `commands/files.rs` | Directory listing for file browser |
| | `commands/notes.rs` | Load/save/delete notes from `~/.claude/theassociate/notes/` (global) and `~/.claude/theassociate/projects/{encoded}/notes/` (per-project) |
| Data layer | `data/` module | File I/O + parsing for each domain: `sessions`, `transcripts`, `teams`, `tasks`, `inboxes`, `todos`, `plans`, `notes`, `summaries`, `projects`, `git`, `hook_state`, `watcher_state`, `path_encoding` |
| Models | `models/` module | Serde structs: `session`, `transcript`, `team`, `task`, `inbox`, `todo`, `plan`, `note`, `summary`, `git`, `hook_event` |
| Watcher | `watcher/claude_watcher.rs` | Watches `~/.claude/` dirs (teams, tasks, projects, todos, plans, notes, theassociate); emits Tauri events on file changes; parses `hook-events.jsonl` for session/subagent lifecycle |
| Git watcher | `watcher/git_watcher.rs` | Watches `.git/HEAD` for active project; emits `git-branch-changed` when branch switches; managed state replaced when project changes |

## Component areas

| Feature | Directory | Key components |
|---------|-----------|----------------|
| Shell chrome | `components/shell/` | TitleBar, ActivityBar, StatusBar, CommandPalette, SettingsPanel |
| Layout | `components/layout/` | IDELayout (resizable 3-panel), TabBar, MainContent |
| Terminal | `components/terminal/` | xterm.js PTY terminal for Claude CLI sessions |
| Sessions | `components/sessions/` | Session list sidebar, session transcript viewer |
| Git | `components/git/` | Sidebar git status, bottom panel git log/diff, branch management |
| PRs & Issues | `components/issues/` | GitHub PR list, issue list + create issue (bottom panel tabs) |
| Dashboard | `components/dashboard/` | NeuralFieldOverlay — mission control overlay (Ctrl+Shift+Space) |
| Projects | `components/projects/` | Project switcher dropdown; session tree view with expandable nodes showing linked plans and summaries |
| Context | `components/context/` | Right panel context viewer (CLAUDE.md, memory files); `PlansPanel` resolves plans to real session IDs and shows linked summaries |
| Plans | `components/plan/` | Markdown plan editor (right panel) |
| Notifications | `components/notifications/` | Claude question notification badges |
| Settings | `components/settings/` | Settings tab (font, integrations) |
| Debug | `components/debug/` | Dev-only debug panel (Ctrl+Shift+D) |
| Files | `components/files/` | File browser sidebar view; `FileEditorTab` has Monaco selection → "Add to note" button |
| README | `components/readme/` | README viewer/editor tab |
| Notes | `components/notes/` | `NotesPanel` (orchestrator), `NotesList` (scoped list), `NoteEditor` (markdown editor + file refs), `CreateIssueModal` (shared issue creation dialog) |

## Storage rules

This is a Tauri desktop app with full filesystem access. **Never use `localStorage` or `sessionStorage`** — they are web primitives tied to the WebView origin, invisible to Rust, and accumulate stale data with no cleanup mechanism.

| Data type | Correct storage |
|-----------|----------------|
| Simple persistent config (flat key-value) | Tauri `plugin-store` → `settings.json` |
| Secrets / credentials | Windows Credential Manager via `keyring` crate |
| Per-project structured data | Tauri command → file in `~/.claude/projects/{encoded}/` |
| Global structured data | Tauri command → file in `~/.claude/` |
| Ephemeral UI state (panel open/closed, etc.) | In-memory Zustand only — no persistence needed |

> **`localStorage` is banned.** If you find existing code using it, migrate it to the appropriate Tauri-backed storage above.

## Critical gotchas (details in docs)

1. **Nested Claude detection** — remove `CLAUDECODE` env var before spawning `claude` → [`docs/terminal.md`](docs/terminal.md)
2. **No StrictMode** — removed from `main.tsx`; PTY sessions are real processes → [`docs/terminal.md`](docs/terminal.md)
3. **crate-type** — only `["staticlib", "rlib"]`, never `cdylib` → [`docs/build.md`](docs/build.md)
4. **PTY uses portable-pty** — real ConPTY, not piped stdio → [`docs/terminal.md`](docs/terminal.md)
5. **Secrets in Windows Credential Manager** — never in settings.json → [`docs/security.md`](docs/security.md)
6. **PATH required for Rust builds** — must set MSYS2 MinGW path → [`docs/build.md`](docs/build.md)
7. **pathToProjectId encoding** — `C:\dev\ide` → `C--dev-ide`; `C:\dev\apex_3.11.0` → `C--dev-apex-3-11-0`; path separators, `.`, and `_` all become `-`; `lib/utils.ts` must stay in sync with Rust `data/path_encoding.rs`
8. **Hook events via file watcher** — `hook-events.jsonl` is append-only; watcher tracks file offset to read only new lines
9. **Claude watcher auto-starts** — `lib.rs` calls `start_claude_watcher()` in `.setup()`; also auto-installs hooks via `cmd_setup_hooks()`
10. **Git branch watcher** — `useGitBranchWatcher()` calls `cmd_watch_git_head(cwd)` when active project changes; watches `.git/HEAD` via `notify` crate; emits `git-branch-changed` event; old watcher dropped when project switches
11. **planLinks maps to session UUIDs, not tab IDs** — `sessionStore.planLinks[filename]` must hold a real Claude session UUID (e.g. `"abc12345-..."`), never a tab DOM ID (e.g. `"session-1729..."`). Both `PlansPanel` and `ProjectSwitcher` match against session UUIDs; wrong type causes "No active plans" / empty tree children → [`docs/architecture.md`](docs/architecture.md) planLinks semantics

## Research reference

Pre-build research docs live in `docs/research/`. Useful when investigating why something was chosen or how a format works:

| Need | Doc |
|------|-----|
| Why was this library chosen? | [`docs/research/tech-stack.md`](docs/research/tech-stack.md) |
| How does `~/.claude/` data look? | [`docs/research/data-formats.md`](docs/research/data-formats.md) |
| Claude CLI flags / session behavior | [`docs/research/cli-integration.md`](docs/research/cli-integration.md) |
| Original architecture plan (phases, colors, memory budget) | [`docs/research/ARCHITECTURE-SPEC.md`](docs/research/ARCHITECTURE-SPEC.md) |
| Original UX spec | [`docs/research/ux-design.md`](docs/research/ux-design.md) |

## Full documentation → [`docs/index.md`](docs/index.md)
