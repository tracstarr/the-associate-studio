# Frontend Bug Report
Generated: 2026-02-23

## HIGH severity

### [useClaudeWatcher] - Listener teardown/rebuild on every activeProjectId change causes event loss
- **File**: src/hooks/useClaudeData.tsx:419
- **Issue**: The `useEffect` dependency array includes `activeProjectId` (indirectly through `openPlanTab` which is a zustand selector, as well as explicitly). Every time the active project changes, all Tauri event listeners (`hook-event`, `session-changed`, `inbox-changed`, `task-changed`, etc.) are torn down and re-subscribed. During the teardown/rebuild window, events emitted by the Rust backend are silently lost.
- **Impact**: Session start/end events, plan links, inbox changes, and notifications can be missed when the user switches projects quickly, leading to stale UI state (e.g., tab not resolving its session, notifications not appearing).
- **Fix**: Extract the Tauri `listen()` calls into a separate `useEffect` with a minimal dependency array (only `queryClient`). Use refs for all store callbacks that change with active project/tab state (the pattern is already partially used with `tabsByProjectRef` and `activeSubagentsRef`).

### [useClaudeWatcher] - First useEffect has empty deps but captures stale callbacks
- **File**: src/hooks/useClaudeData.tsx:228-255
- **Issue**: The initial `getActiveSessions()` effect has `[]` as its dependency array with an eslint-disable comment, yet it calls `markSessionActive`, `setSubagents`, `resolveTabSession`, and `renameTab` -- which are stable zustand selectors, so they won't go stale. However, the real problem is it reads `tabsByProjectRef.current` synchronously but the `getActiveSessions()` promise resolves asynchronously. By the time the `.then()` runs, `tabsByProjectRef.current` is correct (because the ref is continuously updated at line 219). This is **acceptable** but fragile -- adding any intermediate logic that depends on stale snapshot state would break.
- **Impact**: Low probability but high consequence if the pattern is extended -- resolved session IDs could be linked to wrong tabs.
- **Fix**: This is currently correct but document the contract that tabsByProjectRef must always be kept in sync.

### [useGitAction] - Stale closure captures `bottomPanelOpen` at render time
- **File**: src/hooks/useGitAction.ts:7-8
- **Issue**: `bottomPanelOpen` and `toggleBottomPanel` are captured at hook call time. The returned async function uses `bottomPanelOpen` inside its body. If the panel state changes between when the hook re-renders and when the async function is invoked, the check `if (!bottomPanelOpen)` uses a stale value. This means if the panel is opened between the render and the function call, it could be toggled **closed** instead.
- **Impact**: Bottom panel flickers or closes unexpectedly when running git actions rapidly.
- **Fix**: Read the current state inside the async function body: `if (!useUIStore.getState().bottomPanelOpen) useUIStore.getState().toggleBottomPanel()`.

### [useKeyBindings] - Entire store objects in dependency array cause effect to re-register on every state change
- **File**: src/hooks/useKeyBindings.ts:9-11, 192
- **Issue**: `useUIStore()`, `useSessionStore()`, and `useSettingsStore()` (called without a selector) return the entire store objects. These change on **every** state update to those stores. The `useEffect` at line 17 depends on `[ui, session, settings, ...]` which means the keydown listener is removed and re-added on every single UI toggle, tab switch, font size change, etc.
- **Impact**: Extremely high frequency of event listener churn. While React batches state updates, this is wasteful and could cause momentary gaps where keyboard shortcuts don't work (between removeEventListener and addEventListener).
- **Fix**: Use individual selectors for only the state values needed, or use refs to track the store state and keep the effect dependency array stable.

### [CommandPalette] - Commands are memoized once and never refresh
- **File**: src/components/shell/CommandPalette.tsx:11
- **Issue**: `useMemo(() => buildCommands(), [])` -- the empty dependency array means the command list is built exactly once when CommandPalette first mounts. The `buildCommands()` function calls `getState()` on all stores, capturing their values at that moment. Since the command palette is always mounted (rendered conditionally via `commandPaletteOpen`), the commands list never updates. The actions will use stale `activeProjectId`, `fontSize`, `session` state, etc.
- **Impact**: Commands like "New Claude Session", "Close Current Tab", "Increase Font Size" will operate on stale project/tab/font state from when the component first mounted. For example, creating a new session always targets the initially-active project, not the current one.
- **Fix**: Rebuild commands when the palette opens: `useMemo(() => buildCommands(), [commandPaletteOpen])` or remove memoization since `buildCommands()` uses `getState()` (reads current store state directly), but the issue is the command *actions* are closures that also capture `getState()` at build time -- actually re-examining the code, the actions call `getState()` inside themselves for some operations. Verify each action reads fresh state.

### [TerminalView] - `resumeSessionId` not in useEffect dependency array
- **File**: src/components/terminal/TerminalView.tsx:147
- **Issue**: The main `useEffect` that spawns the PTY depends on `[sessionId, cwd]` but not `resumeSessionId`. If a parent component re-renders the same `TerminalView` with the same `sessionId` and `cwd` but a different `resumeSessionId`, the PTY will not re-spawn with the new resume target.
- **Impact**: Resume-after-tab-switch could silently fail to resume the intended session.
- **Fix**: Add `resumeSessionId` to the dependency array -- but note the effect's cleanup kills the PTY, so changing `resumeSessionId` alone should be rare. Document the expected lifecycle.

### [GitStatusPanel] - `activeProjectDir!` non-null assertion on potentially null value
- **File**: src/components/git/GitStatusPanel.tsx:219
- **Issue**: In the `handleFileClick` function's `else` branch, `activeProjectDir!` is used with a non-null assertion. However, this branch is reachable when `activeProjectId` is falsy OR `activeProjectDir` is falsy (the condition on line 201 is `if (activeProjectId && activeProjectDir)`). If `activeProjectId` is set but `activeProjectDir` is null, we enter the `else` branch and crash.
- **Impact**: Runtime crash (`Cannot read properties of null`) when clicking a file entry with a project that has a null path.
- **Fix**: Guard with an early return or use optional chaining.

## MEDIUM severity

### [outputStore] - Unbounded message list growth
- **File**: src/stores/outputStore.ts:21-36
- **Issue**: Unlike `debugStore` which caps at 500 entries, `outputStore` has no maximum size limit. Every git action, status message, etc. appends indefinitely.
- **Impact**: Memory grows unbounded over long sessions. With frequent git operations, this could consume significant memory.
- **Fix**: Add a `MAX_MESSAGES` cap similar to `debugStore`.

### [notificationStore] - No maximum notification count
- **File**: src/stores/notificationStore.ts:22-44
- **Issue**: Notifications accumulate indefinitely. While the dedup logic prevents multiple unread notifications per tab, read notifications are never pruned automatically.
- **Impact**: Over a long session with many Claude questions, the notification dropdown gets very long and memory usage grows.
- **Fix**: Cap at a reasonable maximum (e.g., 50) and evict oldest read notifications first.

### [settingsStore] - Race condition between consecutive setter calls
- **File**: src/stores/settingsStore.ts:53-76
- **Issue**: Each setter (e.g., `setFontSize`) calls `set()` and then `persistConfig()` asynchronously. The `persistConfig` function calls `get()` to read current state. If two setters fire in rapid succession (e.g., `setFontSize(15)` followed immediately by `setFontFamily("...")`), the second `persistConfig` call may overwrite the first's pending `store.save()` with stale values because `get()` may not yet reflect the second set.
- **Impact**: Settings occasionally fail to persist correctly when multiple settings change nearly simultaneously.
- **Fix**: Debounce `persistConfig` or read all values from the latest state in a single `persistConfig` call.

### [useClaudeWatcher] - getActiveSessions promise error silently swallowed
- **File**: src/hooks/useClaudeData.tsx:254
- **Issue**: `.catch(() => {})` silently swallows all errors from the initial session scan. If the backend command fails (e.g., file system error reading session data), the user gets no feedback.
- **Impact**: Initial session state may be incorrect with no indication to the user.
- **Fix**: At minimum log the error; consider showing a notification.

### [SessionView] - Uses array index as key for TranscriptRow
- **File**: src/components/sessions/SessionView.tsx:110
- **Issue**: `filtered.map((item, i) => <TranscriptRow key={i} item={item} />)` uses array index as key. The `filtered` array is reversed (`slice().reverse()`) and filtered, so when new messages arrive and the array is re-reversed, items shift positions. React may incorrectly reuse DOM elements, causing visual glitches or incorrect rendering.
- **Impact**: Transcript display may show wrong text or flicker when new messages arrive.
- **Fix**: Use a stable key derived from the transcript item (e.g., `item.timestamp + item.kind + i` or a hash).

### [InboxPanel] - Uses array index as key for MessageRow
- **File**: src/components/sessions/InboxPanel.tsx:108
- **Issue**: `visibleMessages.map((msg, i) => <MessageRow key={i} message={msg} />)` uses index keys. Messages can be added/removed, causing the same issue as above.
- **Impact**: Incorrect DOM reuse when messages change.
- **Fix**: Use a unique key (e.g., `${msg.from}-${msg.timestamp}-${i}`).

### [TitleBar] - BranchDropdown `onClose` not stable, causes effect re-runs
- **File**: src/components/shell/TitleBar.tsx:68, 89
- **Issue**: `BranchDropdown` receives `onClose={() => setBranchDropdownOpen(false)}` as a prop. This creates a new function reference on every TitleBar render. Inside BranchDropdown, the mousedown listener effect depends on `[onClose]`, so it re-registers the document listener on every parent re-render.
- **Impact**: Unnecessary listener churn, mild performance degradation.
- **Fix**: Wrap `onClose` in `useCallback` in TitleBar, or remove `onClose` from the BranchDropdown effect's dependency array.

### [TitleBar] - ProjectDropdown `onClose` same issue
- **File**: src/components/shell/TitleBar.tsx:206, 219
- **Issue**: Same pattern as BranchDropdown -- `onClose` is an inline arrow function, causing the mousedown listener inside ProjectDropdown to re-register on every render.
- **Impact**: Same as above.
- **Fix**: Same as above.

### [NeuralFieldCanvas] - Physics nodes mutated in-place violates React expectations
- **File**: src/components/dashboard/NeuralFieldCanvas.tsx:239-258
- **Issue**: When syncing physics nodes with props, existing `PhysicsNode` objects in the `physicsRef` Map are mutated directly (`p.label = node.label`, `p.homeX = c.x`, etc.). While this is technically fine for refs (not state), the `FieldNode` objects from props are spread into PhysicsNode, and props should be treated as immutable. The in-place mutation pattern means the ref map entries share identity across renders.
- **Impact**: Low -- since these are ref-stored physics objects used only by the canvas animation loop, not React state. But any future change that reads these values in a React render path would see stale/mutated data.
- **Fix**: Accept current pattern but document that physicsRef entries are intentionally mutable and must never be used in React rendering.

### [DebugPanel] - Unconditional hook calls after early return
- **File**: src/components/debug/DebugPanel.tsx:83-88
- **Issue**: The component has `if (!import.meta.env.DEV) return null;` at line 83, followed by hook calls (`useDebugStore`, `useUIStore`, `useRef`, `useEffect`) at lines 85-95. In React, hooks must be called unconditionally and in the same order on every render. If `import.meta.env.DEV` changes between renders (it won't in practice since it's a compile-time constant), this would violate the Rules of Hooks.
- **Impact**: In practice this is safe because `import.meta.env.DEV` is a build-time constant, so the condition is always the same. However, this is a React anti-pattern that linters would flag, and it makes the code fragile if the condition were ever changed to a runtime value.
- **Fix**: Move the early return after all hook calls, or restructure with conditional rendering in the parent.

### [projectsStore] - `removeProject` doesn't await `deleteProject` before updating state
- **File**: src/stores/projectsStore.ts:39-47
- **Issue**: `removeProject` awaits `deleteProject(id)` then updates state. If `deleteProject` throws, the state is not updated (which is correct). However, there's no try/catch, so the rejection propagates to the caller. If the caller doesn't handle it, it becomes an unhandled rejection.
- **Impact**: Unhandled promise rejection if backend delete fails.
- **Fix**: Add try/catch or ensure all callers handle the rejection.

## LOW severity / Best Practice Issues

### [main.tsx] - XSS via error message interpolation
- **File**: src/main.tsx:13
- **Issue**: `root.innerHTML = \`...\${String(event.error?.stack || event.message)}\`\`` directly interpolates error strings into HTML without escaping. If an attacker can influence the error message (unlikely in a desktop app but possible via crafted filenames or terminal output), they could inject HTML/JS.
- **Impact**: Very low in a Tauri desktop app context, but still a code quality issue.
- **Fix**: Use `textContent` instead of `innerHTML`, or escape the string.

### [pathToProjectId] - Duplicate function definition
- **File**: src/lib/utils.ts:9-14 and src/stores/projectsStore.ts:77-82
- **Issue**: `pathToProjectId` is defined identically in both files. The `useClaudeData.tsx` hook imports from `utils.ts` (line 7), while `GitStatusPanel.tsx` imports from `projectsStore.ts` (line 9).
- **Impact**: Code duplication; risk of divergence if one is updated but not the other.
- **Fix**: Keep only the `utils.ts` version and re-export from `projectsStore.ts` if needed.

### [cn] - Duplicate function definition
- **File**: src/lib/cn.ts and src/lib/utils.ts (lines 1-6 in both)
- **Issue**: The `cn` function and its imports are defined identically in both `cn.ts` and `utils.ts`. Some components import from `@/lib/utils` and others from `@/lib/cn`.
- **Impact**: Code duplication; either file could be removed.
- **Fix**: Keep one and re-export from the other, or consolidate.

### [useKeyBindings] - `Ctrl+B` and `Ctrl+Shift+B` handling is duplicated
- **File**: src/hooks/useKeyBindings.ts:63-73
- **Issue**: The `case "b"` handler checks `if (shift)` to handle `Ctrl+Shift+B`, and then there's a separate `case "B"` handler that also checks `if (shift)`. On most systems, `Shift+B` produces the key `"B"` (uppercase), so both branches may fire. The `case "b"` branch handles both with/without shift, making the `case "B"` redundant.
- **Impact**: The `case "B"` branch is dead code -- it does the same thing as the `shift` check in `case "b"`.
- **Fix**: Remove the `case "B"` block.

### [useTeams] - Missing `enabled` guard
- **File**: src/hooks/useClaudeData.tsx:37
- **Issue**: `useTeams(projectCwd?: string)` has no `enabled` guard based on `projectCwd`. When called with `undefined`, it still fires the query with `projectCwd: null`. While the backend may handle this gracefully, it's inconsistent with the pattern used by other hooks like `useSessions`.
- **Impact**: Unnecessary backend calls when no project is active.
- **Fix**: Add `enabled: !!projectCwd`.

### [SessionsList] - Component is dead code
- **File**: src/components/sessions/SessionsList.tsx:1
- **Issue**: The file header comment says "SessionsList is no longer rendered directly -- replaced by ProjectSwitcher. Kept for reference." This is dead code checked into the repository.
- **Impact**: Maintenance burden; confusing for new contributors.
- **Fix**: Remove the file or move to a docs/archive directory.

## Summary
- 7 HIGH, 8 MEDIUM, 6 LOW issues found
- Most critical: stale closures in `useGitAction` and `useKeyBindings`, event listener churn in `useKeyBindings`, stale command list in `CommandPalette`, potential event loss in `useClaudeWatcher` during project switches
- Pattern-level issues: several components use index keys for lists, multiple stores lack size bounds, and outside-click handlers are rebuilt on every render due to unstable callback props
