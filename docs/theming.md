# Theming

## Color system

All colors are defined as CSS custom properties in `src/index.css` under `@theme`. Tailwind v4 picks these up automatically and generates utility classes.

### Background layers (dark to light)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-bg-base` | `#0D1117` | App root background |
| `--color-bg-surface` | `#161B22` | Panels, sidebar, titlebar |
| `--color-bg-raised` | `#1C2128` | Cards, dropdowns |
| `--color-bg-overlay` | `#21262D` | Command palette, settings modal |
| `--color-bg-input` | `#0D1117` | Input field backgrounds |
| `--color-bg-terminal` | `#0A0E14` | xterm.js terminal background |

### Text

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-text-primary` | `#E6EDF3` | Main content, headings |
| `--color-text-secondary` | `#8B949E` | Labels, secondary info |
| `--color-text-muted` | `#484F58` | Placeholders, disabled, timestamps |
| `--color-text-link` | `#58A6FF` | Hyperlinks |
| `--color-text-inverse` | `#0D1117` | Text on light backgrounds |

### Accent

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-accent-primary` | `#58A6FF` | Links, focus rings, active state, cursor |
| `--color-accent-secondary` | `#BC8CFF` | Claude-related highlights, session icons |
| `--color-accent-tertiary` | `#79C0FF` | Additional accent (lighter blue) |

### Status

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-status-success` | `#3FB950` | Running, connected, active |
| `--color-status-error` | `#F85149` | Failed, error, disconnected |
| `--color-status-warning` | `#D29922` | Idle, pending, warning |
| `--color-status-info` | `#58A6FF` | Informational status |

### Agent status

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-agent-running` | `#3FB950` | Agent actively running |
| `--color-agent-idle` | `#D29922` | Agent idle |
| `--color-agent-completed` | `#8B949E` | Agent finished |
| `--color-agent-error` | `#F85149` | Agent error state |
| `--color-agent-pending` | `#484F58` | Agent waiting to start |

### Session status

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-session-running` | `#3FB950` | Session actively running |
| `--color-session-idle` | `#D29922` | Session idle |
| `--color-session-completed` | `#8B949E` | Session finished |
| `--color-session-error` | `#F85149` | Session error state |

### Git diff

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-diff-add-bg` | `#12261E` | Added line background |
| `--color-diff-add-text` | `#3FB950` | Added line text |
| `--color-diff-add-highlight` | `#1B4332` | Added word highlight |
| `--color-diff-remove-bg` | `#2D1215` | Removed line background |
| `--color-diff-remove-text` | `#F85149` | Removed line text |
| `--color-diff-remove-highlight` | `#5C1D24` | Removed word highlight |
| `--color-diff-modified-bg` | `#2A1F0B` | Modified line background |
| `--color-diff-modified-text` | `#D29922` | Modified line text |
| `--color-diff-hunk-header` | `#1C2128` | Hunk header background |
| `--color-diff-hunk-text` | `#BC8CFF` | Hunk header text |

### Activity bar

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-actbar-bg` | `#0D1117` | Activity bar background |
| `--color-actbar-icon-default` | `#484F58` | Inactive icon color |
| `--color-actbar-icon-active` | `#E6EDF3` | Active icon color |
| `--color-actbar-indicator` | `#58A6FF` | Active view indicator |
| `--color-actbar-badge` | `#F85149` | Notification badge |

### Border

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-border-default` | `#30363D` | Panel borders, dividers |
| `--color-border-muted` | `#21262D` | Subtle borders |
| `--color-border-focus` | `#58A6FF` | Focused inputs (matches accent-primary) |

### Font families

| Variable | Value | Used for |
|----------|-------|---------|
| `--font-mono` | `"Cascadia Code", "JetBrains Mono", "Fira Code", monospace` | Terminal, code |
| `--font-ui` | `"Inter", -apple-system, system-ui, sans-serif` | UI text (body default) |

### xterm.js theme

The terminal uses these same values mapped to xterm's 16-color palette:

```ts
theme: {
  background:  "#0A0E14",   // bg-terminal
  foreground:  "#E6EDF3",   // text-primary
  cursor:      "#58A6FF",   // accent-primary
  red:         "#F85149",   // status-error
  green:       "#3FB950",   // status-success
  yellow:      "#D29922",   // status-warning
  blue:        "#58A6FF",   // accent-primary
  magenta:     "#BC8CFF",   // accent-secondary
  // ...
}
```

## Tailwind v4 CSS-first setup

Tailwind v4 uses `@theme` in CSS instead of a JS config file. Colors become CSS variables automatically.

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-bg-base: #0D1117;
  --color-accent-primary: #58A6FF;
  /* ... */
}
```

Generated utility classes:
- `bg-bg-base` → `background-color: var(--color-bg-base)`
- `text-accent-primary` → `color: var(--color-accent-primary)`
- `border-border-default` → `border-color: var(--color-border-default)`

Inline style access: `style={{ color: "var(--color-accent-primary)" }}`

## Design rationale

The palette is based on GitHub's dark theme (`#0D1117` base). This was chosen because:
1. Claude's own UI uses a similar dark palette — sessions feel "native" in the terminal
2. Users spending time in this IDE are likely already accustomed to GitHub dark theme
3. The colors have strong contrast ratios suitable for long coding sessions
