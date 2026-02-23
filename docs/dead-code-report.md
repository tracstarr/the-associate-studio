# Dead Code Report
Generated: 2026-02-23

## Unused TypeScript Exports

### Barrel Index Files (Never Imported)

All five barrel `index.ts` files exist but are **never imported** by any consumer. Components are always imported directly from their source files (e.g., `from "@/components/git/GitStatusPanel"` instead of `from "@/components/git"`).

- `src/components/context/index.ts` — exports `ContextPanel`, `TeamsRightPanel`, `PlansPanel`
- `src/components/git/index.ts` — exports `GitStatusPanel`, `DiffViewer`
- `src/components/issues/index.ts` — exports `PRListPanel`, `IssueListPanel`
- `src/components/sessions/index.ts` — exports `SessionsList`, `TeamsPanel`, `InboxPanel`
- `src/components/terminal/index.ts` — exports `TerminalView`

### Dead Components (Exported But Never Rendered)

| Component | File | Notes |
|-----------|------|-------|
| `SessionsList` | `src/components/sessions/SessionsList.tsx` | Comment on line 1 says "no longer rendered — replaced by ProjectSwitcher". Only exists in its own file + barrel index. |
| `TeamsPanel` | `src/components/sessions/TeamsPanel.tsx` | Only exists in its own file + barrel index. Never imported by any layout/shell. |
| `InboxPanel` | `src/components/sessions/InboxPanel.tsx` | Only exists in its own file + barrel index. Never imported by any layout/shell. |
| `SettingsPanel` | `src/components/shell/SettingsPanel.tsx` | Exported but **never imported** anywhere. Appears to be a predecessor of `SettingsTab.tsx` which is actively used. ~600 lines of dead code. |

### Dead `lib/cn.ts` File

`src/lib/cn.ts` exports a `cn()` function identical to the one in `src/lib/utils.ts`. No file imports from `@/lib/cn` or `./cn`. The entire file is dead.

### Dead Wrapper Functions in `src/lib/tauri.ts`

These wrapper functions are defined but never imported. `TerminalView.tsx` calls `invoke()` directly instead of using the wrappers:

| Function | Line |
|----------|------|
| `ptySpawn()` | 366 |
| `ptyWrite()` | 370 |
| `ptyKill()` | 374 |
| `ptyList()` | 378 |

### Dead Types in `src/lib/tauri.ts`

These types are defined in `tauri.ts` but never imported by any other file:

| Type | Line |
|------|------|
| `WorktreeInfo` | 122 |
| `TodoItem` | 76 |
| `TodoFile` | 82 |
| `TranscriptItemKind` | 105 |
| `GitFileSection` | 132 |

### Dead Hook in `src/hooks/useClaudeData.ts`

| Hook | Line | Notes |
|------|------|-------|
| `useSendInboxMessage()` | 65 | Defined but never imported by any component |

## Unused Rust Code

### `#[allow(dead_code)]` Attributes

| File | Line | Field |
|------|------|-------|
| `src-tauri/src/data/sessions.rs` | 33 | `JsonlEnvelope::session_id` — field deserialized but never read |

### Unused Cargo Dependency

| Crate | Cargo.toml | Notes |
|-------|-----------|-------|
| `uuid` | Line 26 | `uuid::Uuid` is never referenced anywhere in the Rust source. Zero imports, zero uses. |

## Potentially Unused npm Dependencies

### Confirmed Unused (zero imports in `src/`)

| Package | package.json |
|---------|-------------|
| `@tanstack/react-virtual` | Line 15 |
| `class-variance-authority` | Line 24 |

### Likely Unused Frontend Bindings (Rust plugins registered but JS never imported)

| Package | Notes |
|---------|-------|
| `@tauri-apps/plugin-fs` | Rust plugin registered in `lib.rs` but the JS package is never imported. All file I/O goes through custom Tauri commands. |
| `@tauri-apps/plugin-shell` | Rust plugin registered in `lib.rs` but the JS package is never imported. Shell operations go through custom PTY commands. |

**Note:** Tauri plugins require both Rust and JS sides. If the frontend JS is truly never called, the npm package can be removed (keep the Rust plugin for its backend functionality). Verify before removing.

## Tauri Commands: Registered but Not Called from Frontend

All commands registered in `src-tauri/src/lib.rs` are invoked from the frontend, either through `src/lib/tauri.ts` wrappers or direct `invoke()` calls. However:

| Command | Notes |
|---------|-------|
| `pty_list` | Registered in `lib.rs:60`, wrapper `ptyList()` defined in `tauri.ts:378`, but **never actually invoked** from any `.tsx` file. The wrapper itself is also dead code (see above). |

## Tauri Commands: Called but Not Registered

No orphaned calls found. All `invoke()` calls in the frontend match registered commands.

## Dead CSS

### CSS Theme Variables Defined but Never Referenced in Components

These CSS custom properties are defined in `src/index.css` `@theme` block but are **only** found in `index.css` itself — never referenced by any Tailwind class in any `.tsx` file:

| Variable | Line | Tailwind Class |
|----------|------|---------------|
| `--color-text-inverse` | 22 | `text-inverse` |
| `--color-accent-tertiary` | 28 | `accent-tertiary` |
| `--color-agent-running` | 36 | `agent-running` |
| `--color-agent-idle` | 37 | `agent-idle` |
| `--color-agent-completed` | 38 | `agent-completed` |
| `--color-agent-error` | 39 | `agent-error` |
| `--color-agent-pending` | 40 | `agent-pending` |
| `--color-session-running` | 43 | `session-running` |
| `--color-session-idle` | 44 | `session-idle` |
| `--color-session-completed` | 45 | `session-completed` |
| `--color-session-error` | 46 | `session-error` |
| `--color-diff-add-highlight` | 51 | `diff-add-highlight` |
| `--color-diff-remove-highlight` | 55 | `diff-remove-highlight` |
| `--color-diff-modified-bg` | 56 | `diff-modified-bg` |
| `--color-diff-modified-text` | 57 | `diff-modified-text` |
| `--color-actbar-badge` | 65 | `actbar-badge` |
| `--font-ui` | 69 | `font-ui` (only used in `body` rule in `index.css` via `var()`, never as a Tailwind utility class) |

**Note:** `--font-ui` is used in the `body` CSS rule in `index.css`, so it is technically referenced — but only within `index.css` itself, not via Tailwind classes.

## Summary

| Category | Count |
|----------|-------|
| Dead barrel index files | 5 |
| Dead components (never rendered) | 4 |
| Dead utility file (`cn.ts`) | 1 |
| Dead wrapper functions (`tauri.ts` PTY) | 4 |
| Dead TypeScript types | 5 |
| Dead React hooks | 1 |
| Rust `#[allow(dead_code)]` fields | 1 |
| Unused Cargo crate (`uuid`) | 1 |
| Unused npm packages (confirmed) | 2 |
| Likely unused npm packages (plugin-fs, plugin-shell JS bindings) | 2 |
| Registered but never-invoked Tauri command | 1 |
| Unreferenced CSS theme variables | 16 |
| **Total dead code items** | **43** |
