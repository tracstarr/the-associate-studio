# Theming — "Black & Gold" Premium Dark Theme

## Design philosophy

The UI uses a **warm "Black & Gold" dark theme** inspired by Warp Terminal, Arc Browser, Zed Editor, Linear, and Raycast. Key principles:

1. **Lighter warm grays** — backgrounds shifted from near-black to lighter warm grays for better readability
2. **Gold as primary accent** — replacing cold blue with rich gold (`#D4A853`) for a distinctive premium identity
3. **Rounded & breathing** — panels get generous border-radius (12px), gaps between areas, and more padding
4. **Better text contrast** — secondary/muted text colors bumped significantly for readability
5. **Depth through shadows** — soft box-shadows and subtle gradients instead of hard 1px borders
6. **Consistent corner language** — unified rounding scale across all components

## Color system

All colors are defined as CSS custom properties in `src/index.css` under `@theme`. Tailwind v4 picks these up automatically and generates utility classes.

### Background layers (lighter warm gray)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-bg-base` | `#1E1E26` | App root background |
| `--color-bg-surface` | `#282832` | Panels, sidebar, titlebar |
| `--color-bg-raised` | `#32323D` | Cards, hovers, dropdowns |
| `--color-bg-overlay` | `#3A3A48` | Command palette, settings modal |
| `--color-bg-input` | `#222229` | Input field backgrounds |
| `--color-bg-terminal` | `#1A1A22` | xterm.js terminal background |

### Text (brighter, higher contrast)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-text-primary` | `#F5F5F8` | Main content, headings |
| `--color-text-secondary` | `#B0B0C0` | Labels, secondary info |
| `--color-text-muted` | `#7A7A92` | Placeholders, disabled, timestamps |
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
| `--color-agent-completed` | `#B0B0C0` | Agent finished |
| `--color-agent-error` | `#F85149` | Agent error state |
| `--color-agent-pending` | `#7A7A92` | Agent waiting to start |

### Session status

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-session-running` | `#4ACA62` | Session actively running |
| `--color-session-idle` | `#E0A82E` | Session idle |
| `--color-session-completed` | `#B0B0C0` | Session finished |
| `--color-session-error` | `#F85149` | Session error state |

### Git diff (warmer backgrounds)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-diff-add-bg` | `#1C3428` | Added line background |
| `--color-diff-add-text` | `#4ACA62` | Added line text |
| `--color-diff-add-highlight` | `#265840` | Added word highlight |
| `--color-diff-remove-bg` | `#3A1C20` | Removed line background |
| `--color-diff-remove-text` | `#F85149` | Removed line text |
| `--color-diff-remove-highlight` | `#6A2830` | Removed word highlight |
| `--color-diff-modified-bg` | `#382C14` | Modified line background |
| `--color-diff-modified-text` | `#E0A82E` | Modified line text |
| `--color-diff-hunk-header` | `#32323D` | Hunk header background |
| `--color-diff-hunk-text` | `#BC8CFF` | Hunk header text |

### Activity bar

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-actbar-bg` | `#1E1E26` | Activity bar background |
| `--color-actbar-icon-default` | `#7A7A92` | Inactive icon color |
| `--color-actbar-icon-active` | `#F5F5F8` | Active icon color |
| `--color-actbar-indicator` | `#D4A853` | Active view indicator (gold) |
| `--color-actbar-badge` | `#F85149` | Notification badge |

### Border (softer, warmer)

| Variable | Hex | Used for |
|----------|-----|---------|
| `--color-border-default` | `#3A3A4C` | Panel borders, dividers |
| `--color-border-muted` | `#30303E` | Subtle borders (preferred for most use) |
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
  background:  "#1A1A22",   // bg-terminal
  foreground:  "#F5F5F8",   // text-primary
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
  --color-bg-base: #1E1E26;
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
| 2026-02-25 | **Lightened backgrounds, boosted text contrast** | Backgrounds shifted from near-black (#141419) to lighter warm grays (#1E1E26 base). Text colors brightened (#EEEEF2 → #F5F5F8 primary, #9D9DAD → #B0B0C0 secondary, #62627A → #7A7A92 muted) for better readability and pop. Borders, diffs, terminal theme, and activity bar updated to match. |
