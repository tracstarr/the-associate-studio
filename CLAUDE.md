# Claude IDE — Agent Guide

Windows desktop IDE where **Claude Code CLI is the centerpiece**. Built with Tauri v2 (Rust) + React 19.

## Quick orientation

| What | Where |
|------|-------|
| Frontend | `src/` (React + TypeScript) |
| Backend | `src-tauri/src/` (Rust) |
| Docs index | [`docs/index.md`](docs/index.md) |

## Documentation requirement

> **After every significant decision, update the relevant doc in `docs/`.** If no doc fits, create one and link it from `docs/index.md`.

What counts as a significant decision:
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

## Key files

- `src/App.tsx` — root; loads settings on mount, mounts IDEShell
- `src/stores/` — `uiStore`, `sessionStore`, `settingsStore`
- `src/components/shell/` — TitleBar, ActivityBar, StatusBar, CommandPalette, SettingsPanel
- `src-tauri/src/lib.rs` — registers all Tauri commands
- `src-tauri/src/commands/pty.rs` — Claude CLI spawning via portable-pty
- `src-tauri/src/commands/integrations.rs` — GitHub/Linear/Jira auth + Windows Credential Manager

## Critical gotchas (details in docs)

1. **Nested Claude detection** — remove `CLAUDECODE` env var before spawning `claude` → [`docs/terminal.md`](docs/terminal.md)
2. **No StrictMode** — removed from `main.tsx`; PTY sessions are real processes → [`docs/terminal.md`](docs/terminal.md)
3. **crate-type** — only `["staticlib", "rlib"]`, never `cdylib` → [`docs/build.md`](docs/build.md)
4. **PTY uses portable-pty** — real ConPTY, not piped stdio → [`docs/terminal.md`](docs/terminal.md)
5. **Secrets in Windows Credential Manager** — never in settings.json → [`docs/security.md`](docs/security.md)
6. **PATH required for Rust builds** — must set MSYS2 MinGW path → [`docs/build.md`](docs/build.md)

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
