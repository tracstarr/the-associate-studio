# Build Setup

## Toolchain

| Tool | Version | Location |
|------|---------|----------|
| Rust | 1.83.1 | `~/.cargo/bin/` via rustup |
| Rust target | `stable-x86_64-pc-windows-gnu` | GNU toolchain (not MSVC) |
| GCC (MinGW) | mingw-w64-x86_64-gcc | `C:/msys64/mingw64/bin/` |
| MSYS2 | latest | `C:/msys64/` |
| Node.js | 20.x | system |
| npm | 10.x | system |

## Required PATH (must set before any Rust build)

```bash
export PATH="/c/msys64/mingw64/bin:$HOME/.cargo/bin:$PATH"
export PKG_CONFIG_PATH="/c/msys64/mingw64/lib/pkgconfig"
```

This is required because `git2` (libgit2) and `libz-sys` need `pkg-config` and a C compiler visible on PATH.

## Cargo config

`src-tauri/.cargo/config.toml` sets the linker:

```toml
[target.x86_64-pc-windows-gnu]
linker = "x86_64-w64-mingw32-gcc"
```

## Build commands

```bash
# Frontend dev server only (browser preview at http://localhost:1420)
cd /c/dev/the-associate-studio && npm run dev

# Full Tauri dev (native .exe + hot reload)
export PATH="/c/msys64/mingw64/bin:$HOME/.cargo/bin:$PATH"
cd /c/dev/the-associate-studio && npm run tauri dev

# Cargo only (check Rust compiles without running)
cargo build --manifest-path /c/dev/the-associate-studio/src-tauri/Cargo.toml --target x86_64-pc-windows-gnu

# Release build (.exe + installer)
export PATH="/c/msys64/mingw64/bin:$HOME/.cargo/bin:$PATH"
cd /c/dev/the-associate-studio && npm run tauri build
```

## Hot reload behaviour

| Change | Reload mechanism |
|--------|-----------------|
| `.tsx` / `.ts` file | Vite HMR -- instant, no rebuild |
| `.css` | Vite HMR -- instant |
| `.rs` file | `tauri dev` watcher -> cargo rebuild -> restart exe (15-60s) |
| `Cargo.toml` (new dep) | cargo rebuild + download (slower) |

## Known issues and fixes

### "export ordinal too large" linker error
**Cause**: `cdylib` in `crate-type` causes Windows DLL to exceed 65,535 export ordinals.
**Fix**: Remove `cdylib` from `Cargo.toml`. Keep only `["staticlib", "rlib"]`.

### MinGW GCC not found
**Cause**: `C:/msys64/mingw64/bin` not on PATH.
**Fix**: Run `export PATH="/c/msys64/mingw64/bin:..."` before building.

### pkg-config not found (libgit2 / libz-sys build fails)
**Cause**: `PKG_CONFIG_PATH` not set.
**Fix**: `export PKG_CONFIG_PATH="/c/msys64/mingw64/lib/pkgconfig"`.

### Port 1420 already in use
**Cause**: Previous `npm run tauri dev` or `npm run dev` still running.
**Fix**: `netstat -ano | grep ":1420"` then `taskkill //F //PID {pid}`.

### MSYS2 install (first time)
```bash
winget install MSYS2.MSYS2
# Then in MSYS2 shell:
pacman -S mingw-w64-x86_64-gcc
```

## crate-type explanation

`Cargo.toml` for the Tauri lib:
```toml
[lib]
name = "the_associate_studio_lib"
crate-type = ["staticlib", "rlib"]
```

- `staticlib` -- required by Tauri's build system for linking
- `rlib` -- required for unit tests and `cargo check`
- `cdylib` -- **removed** (causes ordinal overflow on Windows)

## Dependency compile times (cold)

On first build, these crates are slow:
- `libgit2-sys` -- compiles libgit2 from C source (~2 min)
- `portable-pty` -- ConPTY bindings (~30s)
- `reqwest` -- HTTP stack (~1 min)
- `tauri-runtime-wry` -- WebView2 bindings (~2 min)

Total cold build: ~4-6 min. Incremental (Rust file change only): ~15-30s.

## NSIS installer hooks

`src-tauri/nsis/installer-hooks.nsh` adds a pre-uninstall step via Tauri's
`bundle.windows.nsis.installerHooks` config. The `NSIS_HOOK_PREUNINSTALL` macro
runs before the uninstaller removes any files, while the app binary is still
on disk.

The hook calls:
```
"$INSTDIR\the-associate-studio.exe" --cleanup
```

The app detects `--cleanup` as the first argument in `lib.rs` (before Tauri
starts), runs `cleanup::run()`, and exits with no window shown. The cleanup:
1. Removes our hook entries from `~/.claude/settings.json` (leaves file intact)
2. Deletes `~/.claude/theassociate/` (`hook.js` + `hook-events.jsonl`)
3. Deletes `%APPDATA%\com.keith.the-associate-studio\` (plugin-store + WebView2 cache)
4. Deletes Windows Credential Manager entries for the `the-associate-studio` service

Summary files (`~/.claude/projects/*/??-summary-*.md`) and all other Claude
CLI data are preserved.

If Tauri's bundler is updated to a major version, re-check that `installerHooks`
is still a supported NSIS config key (see `node_modules/@tauri-apps/cli/config.schema.json`,
key `NsisConfig.properties.installerHooks`).

## CI / GitHub Actions

### Release (`release.yml`)

Triggers on `v*` tag push. Builds with MSVC + static CRT and publishes `assocs.exe`
to a GitHub Release.

### PR Build (`pr-build.yml`)

Triggers on every pull request to `main`. Builds the same portable binary as the
release workflow and uploads it as a GitHub Actions artifact named
`assocs-pr<number>`. The artifact is retained for 14 days.

Key design decisions:
- **Concurrency group** cancels in-progress builds when new commits are pushed
  to the same PR, avoiding wasted runner time.
- **PR comment** is posted (and updated on subsequent pushes) with a direct link
  to the Actions run artifacts section for easy download.
- **Same MSVC + static CRT** build as release to ensure the tested binary matches
  what ships.
- **Cargo cache** keyed on `Cargo.lock` hash for fast incremental builds.

## Project structure

```
the-associate-studio/
  package.json          -- npm scripts (dev, build, tauri)
  vite.config.ts        -- Vite config with Tauri + React plugins
  tsconfig.json         -- TypeScript config
  src/                  -- Frontend (React + TypeScript)
    main.tsx            -- Entry point (no StrictMode)
    App.tsx             -- Root component, QueryClient, IDEShell
    index.css           -- Tailwind v4 base styles + @theme tokens
    lib/                -- Shared utilities (tauri invoke wrappers, cn helper)
    stores/             -- 7 Zustand stores (ui, session, settings, projects, notification, output, debug)
    hooks/              -- Custom hooks (useKeyBindings, useClaudeData, useGitAction, useActiveProjectTabs)
    components/
      shell/            -- TitleBar, StatusBar, ActivityBar, RightActivityBar, CommandPalette, SettingsPanel
      layout/           -- IDELayout, Sidebar, MainArea, RightPanel, BottomPanel, OutputPanel, TabContextMenu, CloseTabsWarningDialog
      terminal/         -- TerminalView (xterm.js + PTY)
      sessions/         -- SessionsList, SessionView, TeamsPanel, InboxPanel
      git/              -- GitStatusPanel, GitLogPanel, DiffViewer, BranchContextMenu, UntrackedContextMenu
      issues/           -- PRListPanel, IssueListPanel
      files/            -- FileBrowserPanel, FileEditorTab, FileTreeNode
      context/          -- ContextPanel, TeamsRightPanel, PlansPanel
      plan/             -- PlanEditorView
      readme/           -- ReadmeTab
      projects/         -- ProjectSwitcher
      settings/         -- SettingsTab
      notifications/    -- NotificationBell
      dashboard/        -- NeuralFieldOverlay, NeuralFieldCanvas, useNeuralFieldData
      debug/            -- DebugPanel
  src-tauri/            -- Backend (Rust)
    Cargo.toml          -- Rust dependencies
    src/
      lib.rs            -- Tauri app setup, plugin registration, command handler
      main.rs           -- Entry point
      commands/         -- 14 command modules (sessions, teams, tasks, inbox, todos, plans, summaries, git, pty, issues, integrations, hooks, projects, files)
      data/             -- 13 data modules (sessions, teams, inboxes, tasks, todos, plans, summaries, transcripts, git, hook_state, watcher_state, projects, path_encoding)
      models/           -- 10 model modules (session, team, inbox, task, todo, plan, summary, transcript, git, hook_event)
      watcher/          -- claude_watcher.rs (file system watcher)
      utils/            -- Shared utilities
    .cargo/config.toml  -- GNU linker config
  docs/                 -- Documentation
  CLAUDE.md             -- Agent instructions
```
