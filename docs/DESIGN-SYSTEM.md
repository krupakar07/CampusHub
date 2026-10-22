# CampusHub Design System

`css/00-tokens.css` is the central visual control surface. Components consume tokens rather than hard-coding colors, radii, shadows or motion values.

Persistent surfaces avoid expensive full-page blur. Transient overlays may use limited blur. The application uses one primary page scroll container wherever practical to keep scrolling smooth.

## v95 — Light Glass (default)

- The campus photo is gone. `#campusPhotoBackground` now paints `--ds-backdrop`: soft blurred colour blobs on a pale base (edit it in `css/00-tokens.css`).
- Light is the default theme; **Dark** is an option in Settings → Preferences → Appearance. Theme attributes are `data-campushub-theme`, `data-campushub-contrast` and `data-campushub-reduce-motion` (earlier CSS used camelCase names that never matched).
- `css/14-light-glass.css` is the last stylesheet and only applies to the light theme: floating frosted sidebar and top bar, white glass cards, violet active states, readable type scale (nothing under 11px).
- `css/12-responsive.css`: the tablet margin now stops at 761px, which fixes the squeezed layout on phones.

## v96 — Notes editor fixes

- Restored the `#campusTableDialog` markup in `index.html` (lost in the folder refactor) so **Insert → Table** opens the size picker.
- Ribbon menus (Tags, colours, symbols) now really close (`closeMenus` also sets `display:none`), and a menu no longer closes itself from the scroll event fired while it opens.
- Every tag now has a visible style plus its icon (`data-icon`), so To Do, Important, Question, etc. are clearly applied.

## v97 — Mobile drawer fix

- The mobile menu backdrop (z-index 70) was drawn above the drawer (z-index 20), so taps on Settings, Calendar and Sign out hit the backdrop and only closed the menu. The drawer now sits at z-index 90, has a solid background, scrolls if the screen is short, and hides the bottom navigation while open.
- `js/core/app.js` loads scripts with a relative path (`js/`) instead of `/js/`, so the app also works from a sub-folder or GitHub Pages.
