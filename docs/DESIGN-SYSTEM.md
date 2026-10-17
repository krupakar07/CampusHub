# CampusHub Design System

`css/00-tokens.css` is the central visual control surface. Components consume tokens rather than hard-coding colors, radii, shadows or motion values.

Persistent surfaces avoid expensive full-page blur. Transient overlays may use limited blur. The application uses one primary page scroll container wherever practical to keep scrolling smooth.

## v95 — Light Glass (default)

- The campus photo is gone. `#campusPhotoBackground` now paints `--ds-backdrop`: soft blurred colour blobs on a pale base (edit it in `css/00-tokens.css`).
- Light is the default theme; **Dark** is an option in Settings → Preferences → Appearance. Theme attributes are `data-campushub-theme`, `data-campushub-contrast` and `data-campushub-reduce-motion` (earlier CSS used camelCase names that never matched).
- `css/14-light-glass.css` is the last stylesheet and only applies to the light theme: floating frosted sidebar and top bar, white glass cards, violet active states, readable type scale (nothing under 11px).
- `css/12-responsive.css`: the tablet margin now stops at 761px, which fixes the squeezed layout on phones.
