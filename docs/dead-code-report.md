# Dead Code Report
Generated: 2026-02-28

## What Was Cleaned Up (since 2026-02-23 report)

All items below were present in the previous report and have since been removed:

| Item | Type |
|------|------|
| 5 barrel `index.ts` files (context, git, issues, sessions, terminal) | Dead exports |
| `SessionsList.tsx`, `TeamsPanel.tsx`, `InboxPanel.tsx`, `SettingsPanel.tsx` | Dead components |
| `src/lib/cn.ts` | Duplicate utility file |
| `ptySpawn()`, `ptyWrite()`, `ptyKill()`, `ptyList()` wrappers in `tauri.ts` | Dead wrappers |
| `useSendInboxMessage()` in `useClaudeData.ts` | Dead hook |
| `@tanstack/react-virtual`, `class-variance-authority` npm packages | Unused dependencies |
| `uuid` Rust crate | Unused Cargo dependency |
| `JsonlEnvelope::session_id` `#[allow(dead_code)]` field | Dead struct field |
| `pty_list` Tauri command | Registered but never invoked |

---

## Remaining Dead Code

### Unreferenced CSS Theme Variables

These variables are defined in `src/index.css` `@theme` but are never referenced as Tailwind utility classes in any `.tsx` file, and never called via `var()` anywhere in `src/`:

| Variable | Line | Notes |
|----------|------|-------|
| `--color-accent-tertiary` | 31 | `accent-tertiary` class unused; tertiary accent handled by `accent-secondary` in practice |
| `--color-agent-running` | 40 | `agent-running` class unused |
| `--color-agent-idle` | 41 | `agent-idle` class unused |
| `--color-agent-completed` | 42 | `agent-completed` class unused |
| `--color-agent-error` | 43 | `agent-error` class unused |
| `--color-agent-pending` | 44 | `agent-pending` class unused |
| `--color-session-running` | 47 | `session-running` class unused |
| `--color-session-idle` | 48 | `session-idle` class unused |
| `--color-session-completed` | 49 | `session-completed` class unused |
| `--color-session-error` | 50 | `session-error` class unused |
| `--color-diff-add-text` | 54 | DiffViewer uses `text-status-success` instead |
| `--color-diff-add-highlight` | 55 | Unused |
| `--color-diff-remove-text` | 57 | DiffViewer uses `text-status-error` instead |
| `--color-diff-remove-highlight` | 58 | Unused |
| `--color-diff-modified-bg` | 59 | Unused |
| `--color-diff-modified-text` | 60 | Unused |
| `--color-diff-hunk-header` | 61 | DiffViewer uses `bg-bg-raised` instead |
| `--color-diff-hunk-text` | 62 | DiffViewer uses `text-accent-secondary` instead |
| `--color-actbar-badge` | 69 | `actbar-badge` class unused; badges use `bg-status-error` directly |

**Note on `--font-ui`:** Used via `var(--font-ui)` in the `body` rule in `index.css`. Not a Tailwind class, but actively referenced — keep it.

**Note on active diff variables:** `--color-diff-add-bg` (line 53) and `--color-diff-remove-bg` (line 56) ARE used as Tailwind classes (`bg-diff-add-bg`, `bg-diff-remove-bg`) in `DiffViewer.tsx` — do not remove these.

---

## Previously Misreported as Dead (False Positives)

The 2026-02-23 report incorrectly flagged these TypeScript types as dead. They are actively used:

| Type | Where used |
|------|-----------|
| `TodoItem` | Return type component of `TodoFile`; used via `loadTodos()` |
| `TodoFile` | Return type of `loadTodos()` wrapper |
| `WorktreeInfo` | Return type of `listWorktrees()` |
| `TranscriptItemKind` | Union type member of `TranscriptItem` interface |
| `GitFileSection` | Member of `GitFileEntry` interface |

---

## Likely Unused npm Plugin Bindings (carry-over, needs verification)

| Package | Notes |
|---------|-------|
| `@tauri-apps/plugin-fs` | Rust plugin registered in `lib.rs`, JS package never imported in `src/`. All file I/O uses custom Tauri commands. |
| `@tauri-apps/plugin-shell` | Rust plugin registered in `lib.rs`, JS package never imported in `src/`. Shell operations use PTY commands. |

**Note:** The Rust plugin registrations are needed for their backend functionality. Only the npm packages may be removable; verify no indirect usage before removing.

---

## Summary

| Category | Count |
|----------|-------|
| Unreferenced CSS theme variables | 19 |
| Likely unused npm plugin bindings (JS side only) | 2 |
| **Total remaining dead code items** | **21** |
