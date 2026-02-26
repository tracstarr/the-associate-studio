# Testing

Automated testing infrastructure for both the React frontend and Rust backend.

## Quick reference

```bash
# Frontend
npm test              # run all frontend tests once
npm run test:watch    # run in watch mode (re-runs on file change)
npm run test:coverage # run with coverage report

# Backend (from src-tauri/)
cargo test            # run all Rust tests
cargo test sessions   # run tests matching "sessions"
```

## Frontend (Vitest + React Testing Library)

**Stack:** Vitest 4 · React Testing Library · jsdom

**Config:** `vitest.config.ts` — resolves `@/` alias, uses jsdom environment, loads setup file.

**Setup file:** `src/test/setup.ts` — mocks all Tauri APIs (`@tauri-apps/api/core`, `@tauri-apps/plugin-store`, etc.) so tests run outside the Tauri webview.

### Test file locations

Tests live next to the code they test, following the `*.test.ts` / `*.test.tsx` convention:

| Area | File | Tests |
|------|------|-------|
| Utilities | `src/lib/utils.test.ts` | `cn()`, `pathToProjectId()` |
| Frontmatter parser | `src/lib/frontmatter.test.ts` | YAML frontmatter parsing |
| UI store | `src/stores/uiStore.test.ts` | Panel toggles, view switching, notes |
| Session store | `src/stores/sessionStore.test.ts` | Tab lifecycle, close/reorder, resolve |
| Notification store | `src/stores/notificationStore.test.ts` | Add/read/clear, dedup, cap at 50 |
| Output store | `src/stores/outputStore.test.ts` | Add messages, cap at 500 |
| Debug store | `src/stores/debugStore.test.ts` | Entry creation, cap at 500 |

### Writing new tests

1. Create `*.test.ts` (or `.test.tsx` for components) next to the source file
2. Zustand stores: use `useXxxStore.setState({...})` in `beforeEach` to reset state
3. Tauri APIs are mocked globally — `invoke()`, `load()`, etc. are `vi.fn()` by default
4. For component tests, use `@testing-library/react`'s `render()` and `screen` queries

## Backend (Rust `#[cfg(test)]`)

**Extra dev-dependency:** `tempfile` — creates temp directories for file I/O tests.

### Test locations

Tests use Rust's inline `#[cfg(test)] mod tests` convention:

| Module | File | Tests |
|--------|------|-------|
| Path encoding | `data/path_encoding.rs` | Windows path → project ID encoding |
| Sessions | `data/sessions.rs` | Index loading, JSONL scanning, filtering |
| Notes | `data/notes.rs` | Save/load/delete, sorting, project scoping |
| Todos | `data/todos.rs` | Load from dir, skip empties, sort |
| Plans | `data/plans.rs` | Markdown parsing, title extraction, load |
| Teams | `data/teams.rs` | Config loading, CWD filtering, fallback |
| Transcripts | `models/transcript.rs` | Envelope parsing, all message types |

### Writing new Rust tests

1. Add `#[cfg(test)] mod tests { ... }` at the bottom of the module
2. Use `tempfile::tempdir()` for any test that reads/writes files
3. Use `#[test]` for sync tests, `#[tokio::test]` for async tests

## CI Integration

The `pr-build.yml` workflow runs both test suites before building:

```
npm ci → npm test → cargo test → tauri build
```

Tests must pass before the artifact is produced.

## Decisions

- **Vitest over Jest** — native ESM support, same config format as Vite, faster startup
- **Tests next to source** — co-located `*.test.ts` files rather than a separate `tests/` tree, for easier navigation
- **Tauri mocks in setup** — all `@tauri-apps/*` modules mocked globally so every test gets a clean baseline
- **tempfile crate** — auto-cleanup temp dirs avoid polluting the filesystem during tests
