# Tech Stack Research: Claude IDE (Windows)

**Date:** 2026-02-21
**Target:** Tauri v2 + React + TypeScript, fresh start
**Platform:** Windows 11 (primary), potential cross-platform later

---

## Executive Summary

### Final Recommendations

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Framework** | Tauri v2 | 2.10.2 | ~30-40MB RAM idle vs Electron's 200-300MB, <10MB installer, native WebView2 on Windows |
| **Frontend** | React + TypeScript | React 19 + TS 5.x | Mature ecosystem, vast component library availability |
| **Build** | Vite | 6.x | Official Tauri recommendation for SPA frameworks, fast HMR |
| **Terminal** | @xterm/xterm + tauri-plugin-pty | xterm 6.0.0, pty 0.1.1 | Proven integration pattern, PTY via portable-pty on Rust side |
| **UI Components** | shadcn/ui (Radix + Tailwind v4) | Latest | Headless, fully customizable, IDE-grade composability |
| **Layout** | react-resizable-panels | 4.6.4 | IDE splitter panes, pixel/percent/rem units, shadcn integration |
| **Command Palette** | cmdk | 1.0.x | Powers Linear/Raycast palettes, shadcn wraps it natively |
| **State** | Zustand + TanStack Query | Zustand 5.0.11, TQ 5.x | Zustand for client state, TQ for async Rust backend queries |
| **Virtualization** | @tanstack/react-virtual | 3.13.18 | 60FPS virtualized lists for sessions/transcripts, ~12KB |
| **PTY (Rust)** | portable-pty | 0.9.0 | Windows ConPTY support, from wezterm ecosystem |
| **File Watching** | notify | 8.2.0 | Cross-platform, ReadDirectoryChangesW on Windows, production-proven |
| **Git** | git2 | 0.20.4 | libgit2 bindings, threadsafe, avoids shell spawning overhead |
| **Async Runtime** | tokio | 1.x | Standard async runtime, required by Tauri internally |
| **Serialization** | serde + serde_json | 1.x | Standard Rust JSON handling |

---

## 1. Tauri v2 Core

### Version & Status
- **Latest stable:** 2.10.2 (crates.io)
- **CLI:** `@tauri-apps/cli` v2.x
- Uses WebView2 on Windows (Chromium-based, same renderer as Edge)

### IPC System
Tauri v2 provides two IPC primitives:

1. **Commands** (request-response): Frontend invokes Rust functions via `invoke()`, similar to browser `fetch`. Supports binary payloads (new in v2). Rust functions are annotated with `#[tauri::command]`.
2. **Events** (fire-and-forget): Bidirectional - both frontend and Rust core can emit. Best for lifecycle events and state change notifications.

Key improvement in v2: IPC is a mix of the old system and custom protocols, making it faster and supporting binary payloads natively. All IPC routes through the Core process for centralized interception/filtering.

### Multi-Window
- Each window is a separate WebView instance
- Created via `tauri.conf.json` or programmatically from Rust
- Inter-window communication via IPC event relay through the backend
- Capabilities system controls per-window permissions

### System Tray
- Feature flag renamed from `system-tray` to `tray-icon` in v2
- API available in both JS and Rust
- Supports menus, tooltips, titles, click handlers
- Can control menu behavior per click type (left vs right)

### Key Plugins
| Plugin | Version | Purpose |
|--------|---------|---------|
| `tauri-plugin-shell` | 2.3.4 | Spawn child processes, open URLs |
| `tauri-plugin-fs` | 2.4.5 | File system operations |
| `tauri-plugin-process` | 2.x | Process lifecycle management |
| `tauri-plugin-store` | 2.4.2 | Persistent key-value storage |

### Security Model
All potentially dangerous plugin commands are blocked by default. Capabilities must be explicitly configured in `src-tauri/capabilities/` directory. This is good for our use case since we need to carefully scope shell access.

---

## 2. Terminal Embedding

### Architecture: Rust PTY -> IPC -> xterm.js

```
[xterm.js in WebView]  <--IPC Events-->  [Tauri Core]  <--portable-pty-->  [claude CLI process]
     |                                        |                                    |
  Renders output                     Routes data                         PTY on Windows
  Captures input                     Manages lifecycle                   via ConPTY
```

### tauri-plugin-pty (Recommended)
- **Version:** 0.1.1 (published Aug 2025)
- **Author:** Tnze
- **Dependencies:** portable-pty ^0.9.0, serde, tauri ^2
- **npm package:** `tauri-pty`

**Integration pattern:**
```typescript
import { Terminal } from "@xterm/xterm";
import { spawn } from "tauri-pty";

const term = new Terminal();
term.open(containerElement);

const pty = spawn("claude", [], {
  cols: term.cols,
  rows: term.rows,
});

// Bidirectional data transport
pty.onData(data => term.write(data));
term.onData(data => pty.write(data));
```

Full example: https://github.com/Tnze/tauri-plugin-pty/tree/main/examples/vanilla

### portable-pty (Rust side)
- **Version:** 0.9.0
- Part of the wezterm ecosystem
- Windows: Uses ConPTY (`ConPtySystem` struct) for modern Windows 10+ terminal emulation
- Provides `CommandBuilder` API for spawning shell commands
- Cross-platform traits allow runtime selection of implementation

### @xterm/xterm (Frontend side)
- **Version:** 6.0.0 (released Dec 2025)
- Old `xterm` package is deprecated; use scoped `@xterm/*` packages
- Key addons:
  - `@xterm/addon-fit` - Auto-resize terminal to container
  - `@xterm/addon-web-links` - Clickable URL detection
  - `@xterm/addon-search` - In-terminal search
  - `@xterm/addon-clipboard` - Clipboard integration

### Flow Control / Backpressure
xterm.js v5+ has built-in flow control:
- `pause()` and `resume()` methods propagate backpressure to the OS PTY
- Watermark mechanism maintains steady data flow between HIGH/LOW thresholds
- Tracks accumulated bytes, manages pause/resume calls automatically

### Memory Management for xterm.js
- Always call `terminal.dispose()` when unmounting
- Dispose overwrites `.write()` making terminal unusable after (intentional)
- Set addon references to `undefined` on dispose for garbage collection
- Use React `useEffect` cleanup to guarantee disposal
- Avoid retaining references to disposed Terminal objects

### Alternative Reference Projects
- **marc2332/tauri-terminal** - Terminal emulator built with Tauri
- **Shabari-K-S/terminon** - Terminal built with Tauri + React (SSH, WSL, split-pane)
- **freethinkel/fluffy** - "Terminal from future" project

---

## 3. React UI Framework

### shadcn/ui (Primary Recommendation)
- Built on **Radix UI** primitives (accessibility-first, unstyled)
- Styled with **Tailwind CSS v4** (CSS-first config, no `tailwind.config.js`)
- Components are copied into your project (not a dependency) - full control
- Updated for React 19 and Tailwind v4 as of Feb 2026

**Key IDE-relevant components:**
- `Resizable` - Wraps react-resizable-panels for splitter layouts
- `Command` - Wraps cmdk for command palette
- `Dialog` - For modals/settings
- `Tabs` - For tab switching
- `ScrollArea` - For independent panel scrolling
- `Toast/Sonner` - For notifications
- `Tooltip` - For hover hints

### react-resizable-panels (v4.6.4)
- IDE-grade split-view layouts
- Supports units: pixels, percentages, REMs/EMs
- `Separator` component (renamed from `PanelResizeHandle` in v4)
- `orientation` prop (renamed from `direction` in v4)
- Supports `minSize` to prevent panel collapse
- Server-rendering compatible

**IDE Layout Pattern:**
```
+----------------------------------+
|  Toolbar / Command Bar           |
+--------+----------+--------------+
|        |          |              |
| Side   | Terminal | Agent        |
| Panel  | Panel    | Panel        |
|        |          |              |
+--------+----------+--------------+
|  Status Bar                      |
+----------------------------------+
```
Each panel uses `ResizablePanel` with `ResizableSeparator` between them.

### cmdk (Command Palette)
- Powers command palettes in Linear, Raycast
- Unstyled, composable with shadcn
- Keyboard-first navigation
- Fast fuzzy search built-in
- Requires React 18+ (uses `useId`, `useSyncExternalStore`)

### @tanstack/react-virtual (v3.13.18)
- Headless virtualization for massive lists
- ~12-15KB with tree-shaking
- 60FPS rendering guarantee
- Supports: vertical, horizontal, grid virtualization
- Window-scrolling, fixed/variable/dynamic sizing
- Use for: session transcript lists, agent activity feeds, file trees

### Tailwind CSS v4
- **CSS-first configuration** - all config in main CSS file via `@theme` directive
- No more `tailwind.config.js`
- Vite plugin: `@tailwindcss/vite`
- Faster compilation, smaller output
- Better IDE integration with CSS-native config

---

## 4. State Management

### Recommended: Zustand (Client) + TanStack Query (Server)

#### Zustand v5.0.11
- **Bundle:** ~1.1KB gzipped
- **Downloads:** 20M+/week
- **Pattern:** Centralized store, top-down
- **Best for:** UI state (panel sizes, active tabs, theme), session state, user preferences

```typescript
interface IDEStore {
  activeSession: string | null;
  panelLayout: PanelConfig;
  theme: 'light' | 'dark';
  sessions: Map<string, SessionState>;
  // actions
  setActiveSession: (id: string) => void;
  updatePanelLayout: (config: PanelConfig) => void;
}

const useIDEStore = create<IDEStore>((set) => ({
  activeSession: null,
  panelLayout: defaultLayout,
  theme: 'dark',
  sessions: new Map(),
  setActiveSession: (id) => set({ activeSession: id }),
  updatePanelLayout: (config) => set({ panelLayout: config }),
}));
```

**Why Zustand over Jotai for this project:**
- IDE state is interconnected (session affects panels, terminals, sidebar)
- Centralized store better for team collaboration and debugging
- Simpler mental model for a relatively focused state shape
- Middleware support (persist, devtools, immer)

#### TanStack Query v5.x
- **For:** Async data from Rust backend (file trees, git status, session history)
- Automatic caching, background refetching, stale-while-revalidate
- Deduplication of identical requests
- Integrates cleanly alongside Zustand

```typescript
// Fetching git status from Rust backend
const { data: gitStatus } = useQuery({
  queryKey: ['git-status', workingDir],
  queryFn: () => invoke('get_git_status', { path: workingDir }),
  refetchInterval: 5000, // Poll every 5s
});
```

#### Why NOT Jotai
- Jotai excels for fine-grained, atomic state (form builders, editors)
- IDE state is more interconnected than atomic
- Zustand's centralized model is easier to reason about for team development
- For rapidly changing terminal data, we bypass React state entirely (direct xterm.js writes)

---

## 5. Rust Backend Libraries

### Core Dependencies (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2.10", features = ["tray-icon"] }
tauri-plugin-shell = "2.3"
tauri-plugin-fs = "2.4"
tauri-plugin-store = "2.4"
tauri-plugin-pty = "0.1"
portable-pty = "0.9"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
git2 = "0.20"
notify = "8.2"

[build-dependencies]
tauri-build = "2.10"
```

### git2 v0.20.4 (Recommended over shell git)
- libgit2 bindings - no shell spawning overhead
- Threadsafe and memory safe
- Read/write git repositories
- Avoids PATH dependencies and shell escaping issues
- **Alternative considered:** gitoxide/gix (pure Rust, potentially faster but less mature API)
- **Decision:** git2 is battle-tested and sufficient for status/diff/log operations

### notify v8.2.0
- Cross-platform filesystem notification
- Windows: Uses `ReadDirectoryChangesW` API
- Dependencies include `windows-sys ^0.60.1`
- Used by: rust-analyzer, alacritty, deno, cargo-watch
- 62.7M+ total downloads
- **Use case:** Watch `~/.claude/` directory for session changes, config updates

### tokio (Async Runtime)
- Required by Tauri internally
- `features = ["full"]` for complete async support
- Drives: PTY I/O, file watching, IPC handling

### serde/serde_json
- Standard Rust JSON serialization
- Required for Tauri command arguments/returns
- Parse Claude CLI output, session files, config files

### tauri-plugin-shell vs tauri-plugin-pty
| Feature | plugin-shell | plugin-pty |
|---------|-------------|------------|
| Spawn processes | Yes | Yes |
| PTY support | No | Yes (ConPTY) |
| Terminal emulation | No | Yes |
| ANSI/escape codes | Lost | Preserved |
| Interactive CLI | Limited | Full support |
| **Use for claude CLI** | No | **Yes** |

**Decision:** Use `tauri-plugin-pty` for Claude CLI sessions (needs full terminal emulation). Use `tauri-plugin-shell` for simple commands (git operations, file opening).

---

## 6. Monaco Editor

### @monaco-editor/react
- Full VS Code editor in React
- Built-in `DiffEditor` component
- No webpack config needed (works with Vite)
- Handles loading/setup automatically

### Bundle Size Concern
Monaco is heavy (~2-3MB). For our IDE, we likely need it for:
- **Diff viewing** (git diffs, file changes)
- **Code preview** (viewing files agents are editing)
- Not for primary editing (Claude CLI handles that)

### Lighter Alternatives
| Library | Size | Diff Support | Syntax Highlighting |
|---------|------|-------------|---------------------|
| Monaco | ~2-3MB | Built-in DiffEditor | Full (TextMate grammars) |
| CodeMirror 6 | ~150KB base | Via plugin | Via plugin |
| react-simple-code-editor | ~4KB | No | Via Prism.js |
| Shiki (highlighting only) | ~50KB | No | TextMate grammars |

### Recommendation
**Start without Monaco.** Use a lightweight syntax highlighter (Shiki) for code display and only add Monaco if diff viewing becomes a core feature. This saves ~2MB bundle and significant memory. Monaco can be lazy-loaded later when needed.

---

## 7. Memory Efficiency

### Tauri vs Electron Baseline

| Metric | Tauri v2 | Electron |
|--------|---------|---------|
| Idle RAM | 30-40 MB | 200-300 MB |
| Installer size | <10 MB | 80-150 MB |
| Startup time | ~0.4s | ~1.5s |
| WebView | System WebView2 | Bundled Chromium |

**Important caveat:** On Windows, Tauri uses WebView2 (Chromium-based), so the WebView memory usage itself is similar to Electron. The savings come from Rust backend vs Node.js and not bundling Chromium.

### Memory Budget for Claude IDE

| Component | Estimated RAM |
|-----------|--------------|
| Tauri core + Rust backend | 15-25 MB |
| WebView2 (React app) | 80-120 MB |
| xterm.js per terminal | 10-30 MB (depends on scrollback) |
| PTY processes (claude CLI) | 30-50 MB each |
| **Total (1 session)** | **~150-225 MB** |
| **Total (3 sessions)** | **~250-400 MB** |

### Optimization Strategies

1. **xterm.js scrollback limit:** Set `scrollback: 5000` (default is 1000, but Claude output can be verbose). Don't use unlimited.
2. **Terminal disposal:** Always `dispose()` on unmount. Use React `useEffect` cleanup.
3. **Virtualized lists:** Use `@tanstack/react-virtual` for session lists, transcript rendering.
4. **Lazy loading:** Load Monaco only when diff view is opened.
5. **React optimization:**
   - Use `React.memo` for terminal panel components
   - Terminal data bypasses React state (direct xterm.js writes)
   - Avoid re-rendering parent components on terminal output
6. **Rust memory:** Use `tokio::spawn` for concurrent PTY I/O without blocking.
7. **IPC efficiency:** Use binary payloads for PTY data (Tauri v2 feature) instead of JSON-encoding terminal output.

---

## 8. Build & Dev Experience

### Project Initialization

```bash
# Create Tauri v2 + React + TypeScript project
npm create tauri-app@latest claude-ide -- --template react-ts

# Or with pnpm (recommended for monorepo)
pnpm create tauri-app claude-ide --template react-ts
```

### Vite Configuration

```typescript
// vite.config.ts
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri dev server
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

### TypeScript Configuration

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

### Project Structure

```
claude-ide/
  src/                          # React frontend
    components/
      terminal/                 # xterm.js terminal component
      panels/                   # Resizable panel layouts
      command-palette/          # cmdk command palette
      sidebar/                  # Session/agent sidebar
    hooks/                      # Custom React hooks
    stores/                     # Zustand stores
    lib/                        # Utilities, Tauri IPC wrappers
    App.tsx
    main.tsx
    index.css                   # Tailwind v4 CSS config
  src-tauri/                    # Rust backend
    src/
      main.rs                   # Tauri app entry
      commands/                 # Tauri command handlers
        mod.rs
        terminal.rs             # PTY management commands
        git.rs                  # Git operations
        files.rs                # File system operations
        sessions.rs             # Session management
      pty/                      # PTY management module
        mod.rs
        manager.rs              # PTY lifecycle
      watchers/                 # File system watchers
        mod.rs
        claude_dir.rs           # ~/.claude/ watcher
    capabilities/               # Tauri security capabilities
      default.json
    tauri.conf.json             # Tauri configuration
    Cargo.toml
    build.rs
  package.json
  vite.config.ts
  tsconfig.json
  tailwind.css                  # Tailwind v4 CSS-first config
```

### Rust Workspace (optional, for larger projects)

```toml
# Cargo.toml (workspace root, if needed later)
[workspace]
members = ["src-tauri", "crates/*"]

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

For now, start with a single `src-tauri` crate. Extract into workspace members only when complexity warrants it.

### Dev Workflow

```bash
# Development (hot-reload frontend + Rust rebuild)
pnpm tauri dev

# Build for production
pnpm tauri build

# Run only frontend (for UI work without Rust)
pnpm dev
```

---

## Architecture Diagram

```
+------------------------------------------------------------------+
|                        Claude IDE (Tauri v2)                       |
+------------------------------------------------------------------+
|                                                                    |
|  +---------------------------+  +-------------------------------+  |
|  |     WebView2 (Frontend)   |  |      Rust Core (Backend)      |  |
|  |                           |  |                               |  |
|  |  +---------------------+  |  |  +-------------------------+  |  |
|  |  |   React App         |  |  |  |  Tauri Command Handlers |  |  |
|  |  |                     |  |  |  |                         |  |  |
|  |  |  +---------+        |  |  |  |  terminal.rs            |  |  |
|  |  |  | Zustand |        |  |  |  |  git.rs                 |  |  |
|  |  |  | Store   |        |  |  |  |  files.rs               |  |  |
|  |  |  +---------+        |  |  |  |  sessions.rs            |  |  |
|  |  |                     |  |  |  +-------------------------+  |  |
|  |  |  +---------------+  |  |  |                               |  |
|  |  |  | xterm.js      |<-|--IPC--|-->+---------------------+   |  |
|  |  |  | Terminal(s)   |  |  |  |    | PTY Manager          |   |  |
|  |  |  +---------------+  |  |  |    | (portable-pty)       |   |  |
|  |  |                     |  |  |    +----------+-----------+   |  |
|  |  |  +---------------+  |  |  |               |               |  |
|  |  |  | Resizable     |  |  |  |    +----------v-----------+   |  |
|  |  |  | Panels        |  |  |  |    | Claude CLI Process   |   |  |
|  |  |  +---------------+  |  |  |    | (PTY child process)  |   |  |
|  |  |                     |  |  |    +-----------------------+   |  |
|  |  |  +---------------+  |  |  |                               |  |
|  |  |  | Command       |  |  |  |  +-------------------------+  |  |
|  |  |  | Palette(cmdk) |  |  |  |  | File Watcher (notify)  |  |  |
|  |  |  +---------------+  |  |  |  | ~/.claude/ monitoring   |  |  |
|  |  |                     |  |  |  +-------------------------+  |  |
|  |  |  +---------------+  |  |  |                               |  |
|  |  |  | TanStack      |  |  |  |  +-------------------------+  |  |
|  |  |  | Query         |<-|--IPC--|->| Git Ops (git2)        |  |  |
|  |  |  +---------------+  |  |  |  +-------------------------+  |  |
|  |  +---------------------+  |  |                               |  |
|  +---------------------------+  +-------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
|                     System Tray (tray-icon)                       |
+------------------------------------------------------------------+
```

### Data Flow

```
User Input -> xterm.js -> IPC Event -> Tauri Core -> PTY write -> Claude CLI
Claude Output <- xterm.js <- IPC Event <- Tauri Core <- PTY read <- Claude CLI

File Change -> notify watcher -> Tauri Event -> React State Update -> UI Re-render
Git Status -> git2 query -> Tauri Command -> TanStack Query -> React Component
```

---

## Final Recommended Package List

### Frontend (package.json)

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.2",
    "@tauri-apps/plugin-shell": "^2.2",
    "@tauri-apps/plugin-fs": "^2.2",
    "@tauri-apps/plugin-store": "^2.2",
    "tauri-pty": "^0.1",
    "react": "^19.0",
    "react-dom": "^19.0",
    "@xterm/xterm": "^6.0",
    "@xterm/addon-fit": "^0.10",
    "@xterm/addon-web-links": "^0.11",
    "@xterm/addon-search": "^0.15",
    "@xterm/addon-clipboard": "^0.1",
    "react-resizable-panels": "^4.6",
    "cmdk": "^1.0",
    "zustand": "^5.0",
    "@tanstack/react-query": "^5.0",
    "@tanstack/react-virtual": "^3.13",
    "class-variance-authority": "^0.7",
    "clsx": "^2.1",
    "tailwind-merge": "^3.0",
    "lucide-react": "^0.460"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.2",
    "@tailwindcss/vite": "^4.0",
    "tailwindcss": "^4.0",
    "@vitejs/plugin-react": "^4.3",
    "typescript": "^5.7",
    "vite": "^6.0"
  }
}
```

### Backend (Cargo.toml)

```toml
[package]
name = "claude-ide"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2.10", features = ["tray-icon"] }
tauri-plugin-shell = "2.3"
tauri-plugin-fs = "2.4"
tauri-plugin-store = "2.4"
tauri-plugin-pty = "0.1"
portable-pty = "0.9"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
git2 = "0.20"
notify = "8.2"

[build-dependencies]
tauri-build = "2.10"
```

---

## Risk Areas and Mitigations

### 1. tauri-plugin-pty Maturity
- **Risk:** Version 0.1.1, single maintainer (Tnze), limited community testing
- **Mitigation:** The plugin is a thin wrapper around portable-pty (battle-tested, from wezterm). If the plugin becomes unmaintained, we can fork it or build our own Tauri plugin using portable-pty directly. The integration pattern is simple (~50 lines of glue code).

### 2. WebView2 Memory on Windows
- **Risk:** WebView2 is Chromium-based, so per-window memory savings vs Electron may be modest on Windows
- **Mitigation:** Tauri's Rust backend is still much lighter than Node.js. Total app memory stays well under Electron. Use single WebView with panel layout rather than multiple windows where possible.

### 3. xterm.js Memory Leaks
- **Risk:** Long-running terminal sessions with high output can accumulate memory
- **Mitigation:** Set scrollback limits (5000 lines), always dispose terminals on unmount, use `useEffect` cleanup, consider periodic buffer truncation for very long sessions.

### 4. Claude CLI Compatibility
- **Risk:** Claude CLI may change output format, flags, or behavior between versions
- **Mitigation:** Wrap all CLI interaction in an abstraction layer. Parse output through a stable adapter. Monitor Claude CLI changelog.

### 5. Windows ConPTY Edge Cases
- **Risk:** ConPTY has known issues with certain ANSI sequences and terminal applications
- **Mitigation:** ConPTY has matured significantly since Windows 10 1903. Test thoroughly with Claude CLI output. The wezterm project (which maintains portable-pty) actively works around ConPTY issues.

### 6. Tailwind v4 Breaking Changes
- **Risk:** New CSS-first config is a significant change from v3
- **Mitigation:** shadcn/ui already updated for v4 as of Feb 2026. Start fresh with v4 (no migration needed). Good documentation available.

### 7. React 19 Ecosystem Compatibility
- **Risk:** Some libraries may not yet fully support React 19
- **Mitigation:** All recommended libraries (zustand 5, tanstack query 5, cmdk 1.0, xterm.js 6) support React 19. shadcn/ui explicitly targets React 19.

### 8. Bundle Size Growth
- **Risk:** IDE applications tend to accumulate heavy dependencies over time
- **Mitigation:** Defer Monaco editor until needed (use Shiki for highlighting). Use tree-shaking aggressively. Monitor bundle with `vite-plugin-visualizer`. Keep xterm addons to essentials only.

---

## Key References

- Tauri v2 IPC: https://v2.tauri.app/concept/inter-process-communication/
- Tauri v2 Project Structure: https://v2.tauri.app/start/project-structure/
- tauri-plugin-pty: https://github.com/Tnze/tauri-plugin-pty
- portable-pty docs: https://docs.rs/portable-pty
- xterm.js: https://xtermjs.org/
- xterm.js Flow Control: https://xtermjs.org/docs/guides/flowcontrol/
- shadcn/ui Vite Setup: https://ui.shadcn.com/docs/installation/vite
- react-resizable-panels: https://github.com/bvaughn/react-resizable-panels
- Zustand: https://zustand.docs.pmnd.rs/
- TanStack Virtual: https://tanstack.com/virtual/latest
- notify crate: https://github.com/notify-rs/notify
- git2 crate: https://github.com/rust-lang/git2-rs
