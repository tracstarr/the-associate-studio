# UI Overhaul Plan: "Black & Gold" Premium Redesign

## Design Philosophy

The current UI is based on GitHub's cold dark theme (`#0D1117`), which feels too dark, too cold, and too rigid. This overhaul transforms the entire visual identity into a **warm, premium "Black & Gold"** aesthetic inspired by modern tools like Warp Terminal (rounded blocks), Arc Browser (friendly rounded panels), Zed Editor (warm dark tones), Linear (clean spacing), and Raycast (premium feel).

### Core Principles
1. **Warmer, not lighter** — shift from cold blue-blacks to warm charcoal-blacks
2. **Gold as primary accent** — replacing cold blue with rich gold for a distinctive premium identity
3. **Rounded & breathing** — panels get generous border-radius, gaps between areas, and more padding
4. **Better text contrast** — bump secondary/muted text colors significantly for readability
5. **Depth through shadows** — soft box-shadows and subtle gradients instead of hard 1px borders
6. **Consistent corner language** — unified rounding scale across all components

---

## Phase 1: Color Palette Overhaul (`src/index.css`)

Replace the entire `@theme` block with the new warm "Black & Gold" palette:

### Backgrounds (warmer charcoal tones, slightly lighter)

| Variable | Old | New | Rationale |
|----------|-----|-----|-----------|
| `--color-bg-base` | `#0D1117` | `#141419` | Warm near-black (not cold blue) |
| `--color-bg-surface` | `#161B22` | `#1C1C24` | Panels — clearly distinct from base |
| `--color-bg-raised` | `#1C2128` | `#26262F` | Cards, hovers — warm lift |
| `--color-bg-overlay` | `#21262D` | `#2E2E3A` | Modals, dropdowns — premium depth |
| `--color-bg-input` | `#0D1117` | `#18181F` | Input fields — subtle depth |
| `--color-bg-terminal` | `#0A0E14` | `#111116` | Terminal — darkest, still warm |

### Text (warmer whites, better contrast)

| Variable | Old | New | Rationale |
|----------|-----|-----|-----------|
| `--color-text-primary` | `#E6EDF3` | `#EEEEF2` | Warm near-white |
| `--color-text-secondary` | `#8B949E` | `#9D9DAD` | **Much** better contrast on panels |
| `--color-text-muted` | `#484F58` | `#62627A` | Visible muted (was too dark!) |
| `--color-text-link` | `#58A6FF` | `#D4A853` | Gold links |
| `--color-text-inverse` | `#0D1117` | `#141419` | For light bg text |

### Accent (Gold + Purple)

| Variable | Old | New | Rationale |
|----------|-----|-----|-----------|
| `--color-accent-primary` | `#58A6FF` | `#D4A853` | Rich gold — the signature color |
| `--color-accent-secondary` | `#BC8CFF` | `#BC8CFF` | Keep purple for Claude identity |
| `--color-accent-tertiary` | (new) | `#E8C97A` | Lighter gold for hover/highlights |

### Borders (softer, warmer)

| Variable | Old | New | Rationale |
|----------|-----|-----|-----------|
| `--color-border-default` | `#30363D` | `#2E2E3E` | Softer, less stark |
| `--color-border-muted` | `#21262D` | `#242430` | Very subtle warm border |
| `--color-border-focus` | `#58A6FF` | `#D4A853` | Gold focus rings |

### Status (slightly warmer versions)

| Variable | Old | New | Rationale |
|----------|-----|-----|-----------|
| `--color-status-success` | `#3FB950` | `#4ACA62` | Slightly brighter green |
| `--color-status-error` | `#F85149` | `#F85149` | Keep — already warm |
| `--color-status-warning` | `#D29922` | `#E0A82E` | Slightly brighter amber |
| `--color-status-info` | `#58A6FF` | `#D4A853` | Gold info (matches accent) |

### Activity Bar

| Variable | Old | New |
|----------|-----|-----|
| `--color-actbar-bg` | `#0D1117` | `#141419` |
| `--color-actbar-icon-default` | `#484F58` | `#62627A` |
| `--color-actbar-icon-active` | `#E6EDF3` | `#EEEEF2` |
| `--color-actbar-indicator` | `#58A6FF` | `#D4A853` |
| `--color-actbar-badge` | `#F85149` | `#F85149` |

### Git Diff (warmer backgrounds)

| Variable | Old | New |
|----------|-----|-----|
| `--color-diff-add-bg` | `#12261E` | `#152A1F` |
| `--color-diff-add-highlight` | `#1B4332` | `#1E4835` |
| `--color-diff-remove-bg` | `#2D1215` | `#301518` |
| `--color-diff-remove-highlight` | `#5C1D24` | `#5E2027` |
| `--color-diff-modified-bg` | `#2A1F0B` | `#2D220E` |
| `--color-diff-hunk-header` | `#1C2128` | `#26262F` |

### New CSS Variables (additions)

```css
/* Panel treatment */
--color-bg-panel-glow: rgba(212, 168, 83, 0.03);  /* Subtle warm glow on panels */
--radius-panel: 12px;     /* Panel corner radius */
--radius-card: 8px;       /* Card/button radius */
--radius-input: 8px;      /* Input field radius */
--shadow-panel: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03);
--shadow-elevated: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
--shadow-overlay: 0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
```

### xterm.js Theme Updates

Terminal colors updated to match new palette — background, cursor (gold), and foreground updated.

---

## Phase 2: Global CSS & Layout Structure (`src/index.css`)

### Body & Scrollbar
- Update body background, font-smoothing values
- Scrollbar thumb: use `--color-border-default` with `border-radius: 6px`
- Scrollbar thumb hover: use accent-primary at 40% opacity for gold highlight

### Panel Resize Handles
- Default: `transparent` (no visible seam)
- Hover: `var(--color-accent-primary)` with `border-radius: 2px` and subtle glow
- Add `width: 3px` instead of 1px for easier grabbing

### New Global Utility Classes
```css
/* Panel card base — reusable across all panels */
.panel-card {
  background: var(--color-bg-surface);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-panel);
  border: 1px solid var(--color-border-muted);
}
```

---

## Phase 3: Layout Shell Changes

### IDELayout (`src/components/layout/IDELayout.tsx`)
- Add `gap-1.5` (6px) between PanelGroups to create breathing room between panels
- Panel resize handles: `w-1 rounded-full` instead of `w-px`
- Bottom panel resize handle: `h-1 rounded-full` instead of `h-1`
- Add subtle padding wrapper around the main panel area

### TitleBar (`src/components/shell/TitleBar.tsx`)
- `rounded-b-xl` on the titlebar so it has softer bottom edge
- Project chip: `rounded-lg` with subtle gold border on active state
- Branch chip: `rounded-lg`
- Window controls: softer hover states with `rounded-md`
- Add very subtle bottom border-gradient instead of hard 1px border

### ActivityBar (`src/components/shell/ActivityBar.tsx`)
- Icon buttons: `rounded-xl` (was `rounded-md`)
- Active indicator: `w-1 rounded-full bg-accent-primary` with glow: `shadow-[0_0_6px_rgba(212,168,83,0.4)]`
- More generous gaps: `gap-2` (was `gap-1`)
- Width: keep `w-12` but add `py-3` for breathing

### RightActivityBar (`src/components/shell/RightActivityBar.tsx`)
- Mirror activity bar changes
- Active indicator on right side with glow

### StatusBar (`src/components/shell/StatusBar.tsx`)
- `rounded-t-xl` for softer top edge
- Slightly taller: `h-7` (was `h-6`)
- Status dot: gold glow when active

---

## Phase 4: Panel Components

### Sidebar (`src/components/layout/Sidebar.tsx`)
- Container: add `rounded-r-xl` or apply panel-card pattern with margins
- Header: `h-10 px-5` (more generous), `text-text-secondary` (was muted), `rounded-t-xl`
- Section headers (uppercase labels): use `text-accent-primary` instead of `text-text-muted`

### RightPanel (`src/components/layout/RightPanel.tsx`)
- Mirror sidebar treatment with `rounded-l-xl`
- Header padding and text colors improved

### BottomPanel (`src/components/layout/BottomPanel.tsx`)
- Container: `rounded-t-xl` top corners
- Tab strip: pills/chips with `rounded-lg px-4 py-1.5` — not just text toggle
- Active tab: `bg-accent-primary/15 text-accent-primary` with subtle gold glow
- Inactive tab: `text-text-secondary hover:text-text-primary hover:bg-bg-raised/50`

### MainArea Tabs (`src/components/layout/MainArea.tsx`)
- Tab bar: softer, more padded — `h-10` (was `h-9`)
- Active tab: bottom-border style → `rounded-t-lg` with `bg-bg-base` and subtle top gold highlight
- Tab close button: `rounded-full` with hover background
- Welcome screen: larger, friendlier with warm gold accent on the keyboard icon
- Keyboard shortcuts: `rounded-lg` with subtle gold border

---

## Phase 5: Feature Panels

### ProjectSwitcher (`src/components/projects/ProjectSwitcher.tsx`)
- "New Claude Session" button: `rounded-xl` with gold border/accent, slightly taller
- Session items: `rounded-lg mx-2 my-0.5` for card-like feel with subtle hover lift
- Active session: gold left-border accent + subtle background tint
- Remove hard `border-b` between items → use spacing + subtle shadows

### GitStatusPanel (`src/components/git/GitStatusPanel.tsx`)
- Branch header: warm background strip, rounded
- Commit action buttons: `rounded-lg` with gold accent borders on hover
- Section headers: gold dot indicator instead of chevron color
- File entries: `rounded-md mx-1` with subtle hover lift

### ContextPanel (`src/components/context/ContextPanel.tsx`)
- Memory file rows: `rounded-md` hover states with gold dot
- Task items: card-like treatment with `rounded-lg` borders
- Section dividers: subtle gradient line instead of hard border

### SessionView (`src/components/sessions/SessionView.tsx`)
- Session header: `rounded-xl` card treatment with subtle shadow
- "Resume Session" button: gold gradient background, `rounded-xl`
- "Running" badge: green with glow effect, `rounded-xl`
- Transcript rows: `rounded-lg mx-2 my-1` card treatment instead of full-width strips

### CommandPalette (`src/components/shell/CommandPalette.tsx`)
- Outer container: `rounded-2xl` (was `rounded-lg`) with `shadow-overlay`
- Input area: more generous padding, gold focus indicator
- Command items: `rounded-xl` hover states with more padding
- Footer: softer with gold accent on keyboard hints
- Backdrop: warmer blur (`blur(8px)` instead of `blur(2px)`)

### NeuralFieldOverlay (`src/components/dashboard/NeuralFieldOverlay.tsx`)
- HUD counters: use gold for active values instead of blue
- Type badges: gold tinting
- Status dot colors: match new palette

---

## Phase 6: Dropdowns, Dialogs & Context Menus

### All Dropdowns (BranchDropdown, ProjectDropdown, etc.)
- `rounded-xl` (was `rounded`)
- `shadow-overlay` (was `shadow-lg`)
- Items: `rounded-lg mx-1` with generous padding
- Remove hard `border-b` between sections → use spacing

### CloseTabsWarningDialog
- `rounded-2xl` with premium shadow
- Action buttons: `rounded-xl` — destructive red stays, confirm gets gold accent

### TabContextMenu, BranchContextMenu, UntrackedContextMenu
- `rounded-xl` containers
- Items: `rounded-lg` hover states

---

## Phase 7: Remaining Component Updates

### Settings Tab, Plan Editor, Readme Tab, File Editor, etc.
- Apply consistent rounded card patterns
- Better text contrast on all secondary labels
- Input fields: `rounded-lg` with gold focus border
- Buttons: `rounded-lg` with appropriate accent colors

### NotificationBell
- Badge: gold or keep red for urgency, with subtle glow
- Dropdown: `rounded-xl` treatment

### DiffViewer, GitLogPanel
- Warm diff background colors (already covered in Phase 1)
- Line numbers: `text-text-muted` with new improved visibility

### DebugPanel, OutputPanel
- Consistent rounded container treatment
- Better monospace text contrast

---

## Phase 8: Terminal View Updates

### TerminalView (`src/components/terminal/TerminalView.tsx`)
- xterm.js theme: update background, cursor (gold), foreground
- Terminal container: `rounded-xl overflow-hidden` so corners are soft
- Any overlays within terminal: rounded treatment

---

## File Change Summary

### Files Modified (38 total):

**Core Theme (1 file):**
1. `src/index.css` — Complete palette replacement + new utility classes + new CSS variables

**Shell Components (5 files):**
2. `src/components/shell/TitleBar.tsx`
3. `src/components/shell/ActivityBar.tsx`
4. `src/components/shell/RightActivityBar.tsx`
5. `src/components/shell/StatusBar.tsx`
6. `src/components/shell/CommandPalette.tsx`

**Layout Components (6 files):**
7. `src/components/layout/IDELayout.tsx`
8. `src/components/layout/Sidebar.tsx`
9. `src/components/layout/MainArea.tsx`
10. `src/components/layout/RightPanel.tsx`
11. `src/components/layout/BottomPanel.tsx`
12. `src/components/layout/OutputPanel.tsx`

**Session Components (2 files):**
13. `src/components/sessions/SessionView.tsx`
14. `src/components/sessions/SummaryView.tsx`

**Project Components (1 file):**
15. `src/components/projects/ProjectSwitcher.tsx`

**Git Components (5 files):**
16. `src/components/git/GitStatusPanel.tsx`
17. `src/components/git/GitLogPanel.tsx`
18. `src/components/git/DiffViewer.tsx`
19. `src/components/git/BranchContextMenu.tsx`
20. `src/components/git/UntrackedContextMenu.tsx`

**Context Components (4 files):**
21. `src/components/context/ContextPanel.tsx`
22. `src/components/context/TeamsRightPanel.tsx`
23. `src/components/context/PlansPanel.tsx`
24. `src/components/context/DocsSection.tsx`

**Other Feature Components (8 files):**
25. `src/components/dashboard/NeuralFieldOverlay.tsx`
26. `src/components/dashboard/NeuralFieldCanvas.tsx`
27. `src/components/issues/PRListPanel.tsx`
28. `src/components/issues/IssueListPanel.tsx`
29. `src/components/notifications/NotificationBell.tsx`
30. `src/components/files/FileBrowserPanel.tsx`
31. `src/components/files/FileTreeNode.tsx`
32. `src/components/files/FileEditorTab.tsx`

**Tab/Dialog Components (3 files):**
33. `src/components/layout/TabContextMenu.tsx`
34. `src/components/layout/CloseTabsWarningDialog.tsx`
35. `src/components/readme/ReadmeTab.tsx`

**Remaining (3 files):**
36. `src/components/plan/PlanEditorView.tsx`
37. `src/components/settings/SettingsTab.tsx`
38. `src/components/debug/DebugPanel.tsx`

**Terminal (1 file):**
39. `src/components/terminal/TerminalView.tsx`

**Documentation (1 file):**
40. `docs/theming.md` — Full rewrite to document new palette and design decisions

---

## Implementation Order

1. **Phase 1** — `src/index.css` palette swap (highest impact, single file)
2. **Phase 2** — Global CSS utilities and scrollbar/resize handle updates
3. **Phase 3** — Shell layout (TitleBar, ActivityBars, StatusBar, IDELayout)
4. **Phase 4** — Panel containers (Sidebar, RightPanel, BottomPanel, MainArea)
5. **Phase 5** — Feature panels (ProjectSwitcher, GitStatusPanel, ContextPanel, SessionView, CommandPalette)
6. **Phase 6** — Dropdowns, dialogs, context menus
7. **Phase 7** — Remaining components (settings, files, issues, plans, debug, etc.)
8. **Phase 8** — Terminal theme updates + docs/theming.md rewrite
