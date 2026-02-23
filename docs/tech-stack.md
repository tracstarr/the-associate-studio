# Tech Stack

## Frontend

| Library | Version | Why chosen |
|---------|---------|-----------|
| React | 19.x | Concurrent features, mature ecosystem |
| TypeScript | ~5.8 | Required for maintainability at this scale |
| Vite | 6.x | Fast HMR, native ESM, Tauri integration |
| Tailwind v4 | 4.x | CSS-first config (no JS file), CSS variables as design tokens |
| react-resizable-panels | ^2.1 | Handles IDE split layout with persistence |
| @xterm/xterm | ^5.5 | De-facto terminal emulator for web; handles ANSI natively |
| @xterm/addon-fit | ^0.10 | Auto-resize terminal to container |
| @xterm/addon-search | ^0.15 | Terminal text search |
| @xterm/addon-web-links | ^0.11 | Clickable URLs in terminal output |
| @monaco-editor/react | ^4.7 | Monaco editor for plan/readme/file editing tabs |
| Zustand | 5.x | Minimal boilerplate, works outside React components |
| TanStack Query | 5.x | Async data fetching, caching, invalidation |
| @tanstack/react-virtual | ^3.13 | Virtualized lists for large data sets (git log, sessions) |
| cmdk | 1.x | Accessible command palette with fuzzy search |
| lucide-react | latest | Consistent icon set, tree-shakeable |
| react-markdown | ^10.1 | Render markdown content (README preview, context panel) |
| class-variance-authority | ^0.7 | Utility for composing variant-based class names |
| clsx + tailwind-merge | latest | Conditional class name merging |

## Backend (Rust)

| Crate | Version | Why chosen |
|-------|---------|-----------|
| tauri | 2.x | WebView2 + Rust backend; native Windows app without Electron overhead |
| portable-pty | 0.8.x | Windows ConPTY support; real PTY so Claude sees a real terminal |
| notify | 8.x | Cross-platform file watching; uses ReadDirectoryChangesW on Windows |
| git2 | 0.20.x | Rust-native libgit2 bindings; no `git` CLI required for basic ops |
| keyring | 3.x | Windows Credential Manager; OS-level secret storage |
| reqwest | 0.12.x | Async HTTP for GitHub/Linear/Jira API calls |
| open | 5.x | Opens URLs in default browser (OAuth verification URI) |
| serde + serde_json | 1.x | JSON serialization for all data models |
| tokio | 1.x | Async runtime (already pulled in by Tauri) |
| chrono | 0.4.x | Timestamp parsing; handles both ms-epoch and ISO8601 formats |
| uuid | 1.x | Session ID generation |
| anyhow | 1.x | Ergonomic error handling in Tauri commands |
| rfd | 0.14.x | Native file dialog (folder picker for project selection) |

## Tauri plugins

| Plugin | Purpose |
|--------|---------|
| tauri-plugin-store | Persistent JSON settings (non-sensitive config only) |
| tauri-plugin-shell | Shell command execution (gh CLI for PRs/Issues, claude CLI for init/readme) |
| tauri-plugin-fs | File system access from frontend |
| tauri-plugin-opener | Opens files/URLs in OS default handler |

---

## Decision log

### Tauri v2 over Electron
Tauri uses the OS WebView (WebView2 on Windows) and a Rust backend instead of bundling Chromium + Node.js. The result is a ~10MB binary vs ~200MB for Electron, lower RAM usage, and direct access to native Windows APIs without npm packages.

### GNU toolchain over MSVC
MSVC requires Visual Studio Build Tools (~5GB install). The GNU toolchain (via MSYS2 + MinGW) is ~500MB and scriptable. The `stable-x86_64-pc-windows-gnu` Rust target works without any Microsoft tooling.

### `crate-type = ["staticlib", "rlib"]` -- no `cdylib`
Windows DLL exports are limited to 65,535 ordinals. A large Rust library with many symbols hits this limit. Removing `cdylib` from `crate-type` avoids the linker error `"export ordinal too large"`. Tauri's build system works fine with `staticlib + rlib`.

### portable-pty over piped stdio
`std::process::Command` with `Stdio::piped()` creates non-TTY stdin/stdout. Claude Code CLI detects this (via `isatty()`) and switches to `--print` mode, which requires a prompt argument and exits immediately. `portable-pty` creates a real Windows ConPTY so Claude sees an interactive terminal.

### StrictMode removed
React 18 Strict Mode double-invokes effects in development to surface bugs. For this app, effects spawn real OS processes (PTY sessions) and register OS-level event listeners. Double-invocation creates two Claude processes writing to the same xterm.js terminal. StrictMode is disabled in `src/main.tsx`.

### Zustand + TanStack Query split
UI state (which panel is open, which tab is active) changes synchronously and never needs to be fetched from a backend -- Zustand (7 stores). Data that comes from the Rust backend (sessions list, git status, inbox) is async, can fail, and benefits from caching and invalidation -- TanStack Query. Mixing both into one store creates unnecessary complexity.

### gh CLI for PRs/Issues
The GitHub REST/GraphQL API for PRs and Issues is complex and requires token scopes, pagination handling, and type-safe response parsing. The `gh` CLI handles all of this and is already installed as a dependency for the GitHub auth flow. `std::process::Command::new("gh").args([...])` is a simpler integration surface.

### Tailwind v4 CSS-first config
Tailwind v4 moves configuration from `tailwind.config.js` to a CSS file with `@theme` directives. This means design tokens (colors, spacing) are emitted as CSS custom properties, which can be referenced directly in inline styles and component logic without importing a JS config object.

### CLAUDECODE env var removal
Claude Code CLI sets `CLAUDECODE=1` in its own process environment to detect nested invocations. When the IDE (which runs inside Claude Code) spawns a new `claude` process, it inherits this env var, and Claude refuses to start. Calling `cmd.env_remove("CLAUDECODE")` before spawning removes this marker.

### Keyring for secrets
API tokens and OAuth tokens are sensitive. Storing them in `settings.json` (a plain JSON file in `%APPDATA%`) exposes them to any process that can read the file. Windows Credential Manager (accessed via the `keyring` crate) uses DPAPI to encrypt credentials, tied to the user's Windows login. This is the same store used by Git Credential Manager and VS Code.

### Monaco editor for file editing
The `@monaco-editor/react` package provides the same editor used in VS Code. It's used for plan files, README editing, and arbitrary file editing tabs. This gives syntax highlighting, search/replace, and familiar keybindings without building a custom editor.

### rfd for native file dialogs
The `rfd` (Rusty File Dialogs) crate provides native OS file/folder picker dialogs. Used for the project folder selection flow (`cmd_pick_folder`). This gives a native Windows dialog rather than a web-based file picker.

### react-resizable-panels layout
The IDE uses a nested panel layout: a vertical `PanelGroup` splits top content from the bottom panel (full-width), and a horizontal `PanelGroup` inside the top section splits sidebar, main area, and right panel. This ensures the bottom panel spans the full window width.

### @tanstack/react-virtual for large lists
Git log, session lists, and other potentially large data sets use virtualized rendering to maintain smooth performance regardless of list size.
