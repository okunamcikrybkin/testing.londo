# LONDO UI kit

The shared UI kit lives in `app/globals.css`. Use these classes for new pages and components instead of defining page-specific versions of common controls. The site theme supplies the design tokens (`--ui-*`, `--londo-*`, `--accent`, `--foreground`, and `--muted`).

## Surfaces and hierarchy

- `londo-ui-surface` — the standard frosted glass panel/card; use it for one primary surface, not every nested wrapper.
- `londo-ui-surface londo-ui-surface-raised` — a slightly brighter interactive surface.
- `londo-ui-section` — quiet inset group inside a glass panel.
- `londo-ui-eyebrow`, `londo-ui-title`, `londo-ui-description` — shared page and section heading scale.
- `londo-ui-empty` — empty and no-results state; place a `<strong>` title first.

## Forms and actions

- `londo-ui-field` with `londo-ui-label` — label and control grouping.
- `londo-ui-control` — text, number, select, and textarea controls. Use `londo-ui-control` on the native element.
- `londo-ui-search` — search wrapper with icon; put a `type="search"` input inside. The wrapper owns the border and focus ring.
- `londo-ui-button` — neutral action; add `londo-ui-button-primary`, `londo-ui-button-success`, or `londo-ui-button-danger` for semantic variants.
- `londo-ui-icon-button` — square icon-only action; always add an `aria-label`.
- `londo-ui-badge` — compact status/category label. Add `data-tone="success|warning|danger"` for semantic colors.
- `londo-ui-alert` — inline feedback. Select a semantic `data-tone` when appropriate.
- `londo-ui-progress` — determinate progress bar; set the inner bar width from 0% to 100%.

## Navigation and data

- `londo-ui-tabs` — a horizontal set of links/buttons. Use `aria-current="page"` for the active link or `aria-pressed="true"` for the selected button.
- `londo-ui-table-wrap` and `londo-ui-table` — scrollable data table with consistent header, rows, and hover state.
- `londo-ui-divider` and `londo-ui-tooltip` — quiet separators and secondary helper text.

## Composition rules

1. Use one glass layer per visual group. Keep nested toolbars, card headers, and table rows transparent.
2. Use the warm LONDO accent for focus, primary actions, and active navigation. Reserve green, amber, and red for semantic status.
3. Keep touch targets at least 42–46px high, preserve visible keyboard focus, and use a compact-card/table alternative for narrow screens.
4. Page-specific CSS should handle layout only. Reuse the shared surface, controls, buttons, badges, tabs, and table classes for appearance.
