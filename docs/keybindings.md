# Keybindings

## Full reference

### Global

| Key | Action |
|-----|--------|
| `Ctrl+P` | Open command palette |
| `Ctrl+,` | Open settings |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+Shift+B` | Toggle right panel |
| `Ctrl+J` | Toggle bottom panel |
| `Ctrl+N` | New terminal session |
| `Ctrl+W` | Close active tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |

### Sidebar views (Activity Bar)

| Key | View |
|-----|------|
| `Ctrl+1` | Projects & Sessions |
| `Ctrl+2` | Git |
| `Ctrl+3` | PRs / Issues |

### Font size

| Key | Action |
|-----|--------|
| `Ctrl+=` | Increase font size |
| `Ctrl+-` | Decrease font size |
| `Ctrl+0` | Reset font size |

### Bottom panel

| Key | Action |
|-----|--------|
| `Ctrl+Shift+G` | Open Git panel in bottom |

## Implementation

Keybindings are registered in `src/hooks/useKeyBindings.ts` using a `keydown` event listener on `window`. The hook is called once in `IDEShell` (via `App.tsx`).

```ts
// Pattern used in useKeyBindings.ts
window.addEventListener("keydown", handler);
return () => window.removeEventListener("keydown", handler);
```

Actions dispatch to Zustand stores (`uiStore`, `sessionStore`, `settingsStore`) directly using `getState()` — no React context required.

## Command palette

The command palette (Ctrl+P) is built with `cmdk`. Commands are defined in `src/lib/commands.ts` via `buildCommands()` which returns an array of command objects. Each command has:

```ts
interface Command {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
}
```

Categories: View, Session, Settings. ~25 commands total.

## Terminal focus

When a terminal tab is active, keystrokes go to xterm.js (not to the global keybinding system). xterm.js captures keyboard events on its canvas element. Global shortcuts that conflict with terminal use (`Ctrl+C`, `Ctrl+V`) are handled by xterm.js — the global handler never sees them.

Implication: `Ctrl+C` in a terminal sends SIGINT to the Claude process, not a "copy" action. Use `Ctrl+Shift+C` to copy terminal selection (standard xterm.js convention).
