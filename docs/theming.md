# Theming — "Black & Gold" Premium Dark Theme

## Design philosophy

The UI uses a **warm "Black & Gold" dark theme** inspired by Warp Terminal, Arc Browser, Zed Editor, Linear, and Raycast. Key principles:

1. **Warmer, not lighter** — backgrounds shifted from cold blue-blacks to warm charcoal-blacks
2. **Gold as primary accent** — replacing cold blue with rich gold (`#D4A853`) for a distinctive premium identity
3. **Rounded & breathing** — panels get generous border-radius (12px), gaps between areas, and more padding
4. **Better text contrast** — secondary/muted text colors bumped significantly for readability
5. **Depth through shadows** — soft box-shadows and subtle gradients instead of hard 1px borders
6. **Consistent corner language** — unified rounding scale across all components

## Color system

All colors are defined as CSS custom properties in `src/index.css` under `@theme`. Tailwind v4 picks these up automatically and generates utility classes.

### Background layers (warm charcoal, dark to light)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-bg-base` | `#141419` | App root background |
| `--color-bg-surface` | `#1C1C24` | Panels, sidebar, titlebar |
| `--color-bg-raised` | `#26262F` | Cards, hovers, dropdowns |
| `--color-bg-overlay` | `#2E2E3A` | Command palette, settings modal |
| `--color-bg-input` | `#18181F` | Input field backgrounds |
| `--color-bg-terminal` | `#111116` | xterm.js terminal background |

### Text (warm whites, better contrast)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-text-primary` | `#EEEEF2` | Main content, headings |
| `--color-text-secondary` | `#9D9DAD` | Labels, secondary info |
| `--color-text-muted` | `#62627A` | Placeholders, disabled, timestamps |
| `--color-text-link` | `#D4A853` | Hyperlinks (gold) |

### Accent (gold + purple)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-accent-primary` | `#D4A853` | Gold — links, focus rings, active state, cursor |
| `--color-accent-secondary` | `#BC8CFF` | Purple — Claude-related highlights |
| `--color-accent-tertiary` | `#E8C97A` | Lighter gold — hover highlights |

### Status

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-status-success` | `#4ACA62` | Running, connected, active |
| `--color-status-error` | `#F85149` | Failed, error, disconnected |
| `--color-status-warning` | `#E0A82E` | Idle, pending, warning |
| `--color-status-info` | `#D4A853` | Informational status (gold) |

### Agent status

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-agent-running` | `#4ACA62` | Agent actively running |
| `--color-agent-idle` | `#E0A82E` | Agent idle |
| `--color-agent-completed` | `#9D9DAD` | Agent finished |
| `--color-agent-error` | `#F85149` | Agent error state |
| `--color-agent-pending` | `#62627A` | Agent waiting to start |

### Session status

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-session-running` | `#4ACA62` | Session actively running |
| `--color-session-idle` | `#E0A82E` | Session idle |
| `--color-session-completed` | `#9D9DAD` | Session finished |
| `--color-session-error` | `#F85149` | Session error state |

### Git diff (warmer backgrounds)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-diff-add-bg` | `#152A1F` | Added line background |
| `--color-diff-add-text` | `#4ACA62` | Added line text |
| `--color-diff-add-highlight` | `#1E4835` | Added word highlight |
| `--color-diff-remove-bg` | `#301518` | Removed line background |
| `--color-diff-remove-text` | `#F85149` | Removed line text |
| `--color-diff-remove-highlight` | `#5E2027` | Removed word highlight |
| `--color-diff-modified-bg` | `#2D220E` | Modified line background |
| `--color-diff-modified-text` | `#E0A82E` | Modified line text |
| `--color-diff-hunk-header` | `#26262F` | Hunk header background |
| `--color-diff-hunk-text` | `#BC8CFF` | Hunk header text |

### Activity bar

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-actbar-bg` | `#141419` | Activity bar background |
| `--color-actbar-icon-default` | `#62627A` | Inactive icon color |
| `--color-actbar-icon-active` | `#EEEEF2` | Active icon color |
| `--color-actbar-indicator` | `#D4A853` | Active view indicator (gold) |
| `--color-actbar-badge` | `#F85149` | Notification badge |

### Border (softer, warmer)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-border-default` | `#2E2E3E` | Panel borders, dividers |
| `--color-border-muted` | `#242430` | Subtle borders (preferred for most use) |
| `--color-border-focus` | `#D4A853` | Focused inputs (gold) |

### Font families

| Variable | Value | Used for |
|----------|-------|---------|
| `--font-mono` | `"Cascadia Code", "JetBrains Mono", "Fira Code", monospace` | Terminal, code |
| `--font-ui` | `"Inter", -apple-system, system-ui, sans-serif` | UI text (body default) |

### xterm.js theme

The terminal uses the gold cursor and warm foreground:

```ts
theme: {
  background:  "#111116",   // bg-terminal
  foreground:  "#EEEEF2",   // text-primary
  cursor:      "#D4A853",   // accent-primary (gold)
  red:         "#F85149",   // status-error
  green:       "#4ACA62",   // status-success
  yellow:      "#E0A82E",   // status-warning
  blue:        "#D4A853",   // accent-primary (gold)
  magenta:     "#BC8CFF",   // accent-secondary
  // ...
}
```

## Panel design system

### Rounding scale
- Panels/containers: `rounded-xl` (12px)
- Cards/buttons: `rounded-lg` (8px)
- Inputs: `rounded-lg` (8px)
- Overlays/modals: `rounded-2xl` (16px)
- Activity bar icons: `rounded-xl` (12px)
- Small elements: `rounded-md` (6px)

### Spacing
- IDELayout adds `p-1.5 gap-1.5` between panels for breathing room
- Panels "float" inside rounded containers instead of touching edges
- Sidebar, right panel, and bottom panel wrapped in `rounded-xl overflow-hidden bg-bg-surface`

### Shadows
- Panel: `0 1px 3px rgba(0,0,0,0.2)` — subtle depth
- Elevated: `0 4px 12px rgba(0,0,0,0.4)` — dropdowns, overlays
- Overlay: `0 8px 30px rgba(0,0,0,0.5)` — command palette, modals

### CSS utility classes (in `index.css`)
- `.panel-card` — standard panel surface
- `.panel-card-elevated` — elevated surface (overlays)
- `.panel-card-overlay` — full overlay treatment (modals, command palette)
- `.glow-gold` — gold glow effect for active elements
- `.panel-inset` — inset/recessed panel

### Gold glow accents
- Activity bar indicators: `box-shadow: 0 0 6px rgba(212,168,83,0.4)`
- Resize handles on hover: `box-shadow: 0 0 6px rgba(212,168,83,0.3)`
- Scrollbar thumb on hover: `color-mix` with accent-primary

## Tailwind v4 CSS-first setup

Tailwind v4 uses `@theme` in CSS instead of a JS config file. Colors become CSS variables automatically.

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-bg-base: #141419;
  --color-accent-primary: #D4A853;
  /* ... */
}
```

Generated utility classes:
- `bg-bg-base` → `background-color: var(--color-bg-base)`
- `text-accent-primary` → `color: var(--color-accent-primary)`
- `border-border-muted` → `border-color: var(--color-border-muted)`

Inline style access: `style={{ color: "var(--color-accent-primary)" }}`

## Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-21 | GitHub dark theme base | Initial choice for familiarity |
| 2026-02-24 | **Replaced with "Black & Gold" warm theme** | Previous palette too dark and cold. User wanted warmer, more premium feel with gold accents. Inspired by Warp Terminal, Arc Browser, Zed Editor, Linear, Raycast. Key changes: warm charcoal backgrounds (#141419 base), gold primary accent (#D4A853), rounded panel design (12px), better text contrast, breathing room between panels. |
