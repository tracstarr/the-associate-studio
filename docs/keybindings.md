# Keybindings

## Full reference

### Global (always active)

| Key | Action |
|-----|--------|
| `Ctrl+P` | Open command palette |
| `Ctrl+Shift+Space` | Toggle Neural Field (mission control overlay) |
| `Escape` | Close overlays (Neural Field first, then command palette) |

### Panels

| Key | Action |
|-----|--------|
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+Shift+B` | Toggle right panel |
| `Ctrl+J` | Toggle bottom panel |

### Sidebar views (Activity Bar)

| Key | View |
|-----|------|
| `Ctrl+1` | Projects & Sessions |
| `Ctrl+2` | Git |
| `Ctrl+3` | PRs / Issues |

### Session / Tabs

| Key | Action |
|-----|--------|
| `Ctrl+N` | New terminal session |
| `Ctrl+R` | Resume current session-view tab as terminal |
| `Ctrl+W` | Close active tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |

### Project cycling

| Key | Action |
|-----|--------|
| `Ctrl+Shift+Right` | Next project |
| `Ctrl+Shift+Left` | Previous project |

### Settings / Font

| Key | Action |
|-----|--------|
| `Ctrl+,` | Open settings |
| `Ctrl+=` | Increase font size |
| `Ctrl+-` | Decrease font size |
| `Ctrl+0` | Reset font size (13px) |

### Bottom panel

| Key | Action |
|-----|--------|
| `Ctrl+Shift+G` | Open Git panel in bottom |

### Dev-only

| Key | Action |
|-----|--------|
| `Ctrl+Shift+D` | Toggle debug panel (only in `import.meta.env.DEV`) |

## Implementation

Keybindings are registered in `src/hooks/useKeyBindings.ts` using a `keydown` event listener on `window`. The hook is called once in `IDEShell` (via `App.tsx`).

```ts
// Pattern used in useKeyBindings.ts
window.addEventListener("keydown", handler);
return () => window.removeEventListener("keydown", handler);
```

Actions dispatch to Zustand stores (`uiStore`, `sessionStore`, `settingsStore`, `projectsStore`) directly using `getState()` — no React context required.

### Input guard

The handler skips most keybindings when focus is inside an `<input>`, `<textarea>`, or `contentEditable` element. Exceptions: `Ctrl+P` (command palette) and `Ctrl+Shift+Space` (Neural Field) always fire regardless of focus.

## Command palette

The command palette (Ctrl+P) is built with `cmdk`. Commands are defined in `src/lib/commands.ts` via `buildCommands()` which returns an array of command objects. Each command has:

```ts
interface Command {
  id: string;
  label: string;
  description?: string;
  category: string;
  keybinding?: string;
  action: () => void;
}
```

Categories: View, Session, Project, Settings. ~30 commands total.

## Terminal focus

When a terminal tab is active, keystrokes go to xterm.js (not to the global keybinding system). xterm.js captures keyboard events on its canvas element. Global shortcuts that conflict with terminal use (`Ctrl+C`, `Ctrl+V`) are handled by xterm.js — the global handler never sees them.

Implication: `Ctrl+C` in a terminal sends SIGINT to the Claude process, not a "copy" action. Use `Ctrl+Shift+C` to copy terminal selection (standard xterm.js convention).
