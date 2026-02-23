# Theming

## Color system

All colors are defined as CSS custom properties in `src/index.css` under `@theme`. Tailwind v4 picks these up automatically and generates utility classes.

### Background layers (dark to light)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-bg-base` | `#0D1117` | App root background |
| `--color-bg-surface` | `#161B22` | Panels, sidebar, titlebar |
| `--color-bg-raised` | `#1C2128` | Cards, dropdowns, inputs |
| `--color-bg-overlay` | `#21262D` | Command palette, settings modal |
| `--color-bg-terminal` | `#0A0E14` | xterm.js terminal background |

### Text

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-text-primary` | `#E6EDF3` | Main content, headings |
| `--color-text-secondary` | `#8B949E` | Labels, secondary info |
| `--color-text-muted` | `#484F58` | Placeholders, disabled, timestamps |

### Accent

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-accent-primary` | `#58A6FF` | Links, focus rings, active state, cursor |
| `--color-accent-secondary` | `#BC8CFF` | Claude-related highlights, session icons |

### Status

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-status-success` | `#3FB950` | Running, connected, active |
| `--color-status-error` | `#F85149` | Failed, error, disconnected |
| `--color-status-warning` | `#D29922` | Idle, pending, warning |

### Border

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-border-default` | `#30363D` | Panel borders, dividers |
| `--color-border-focus` | `#58A6FF` | Focused inputs (matches accent-primary) |

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
