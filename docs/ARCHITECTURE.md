# CampusHub Architecture

CampusHub is organized by ownership rather than patch history.

## CSS
- `00-tokens.css` — all visual tokens.
- `01-reset.css` — browser normalization.
- `02-base.css` — typography and native controls.
- `03-shell.css` — application shell.
- `04-components.css` — reusable UI primitives.
- `05-pages.css` — secondary page structure and surfaces.
- `06-notes.css` — Notes layout, editor and export UI.
- `07-files.css` — Files.
- `08-calendar.css` — Calendar.
- `09-exams.css` — Exams.
- `10-planner.css` — Planner.
- `11-settings.css` — Settings.
- `12-responsive.css` — responsive behavior.
- `13-accessibility.css` — focus, motion and contrast.

## JavaScript
`core` owns lifecycle/state/routing; `services` own external systems; `features` own user-facing functionality; `ui` owns reusable interaction primitives.

## Rules
1. Do not create `*-patch.css` files.
2. Do not add page-specific selectors to global files when a feature file owns the page.
3. Supabase configuration/client creation belongs only in `js/services/supabase.js`.
4. Notes export functionality lives with the Notes feature entry point.
5. New UI should use tokens from `00-tokens.css`.
