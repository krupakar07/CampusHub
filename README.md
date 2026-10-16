CampusHub v72 — reference-matched floating glass navigation.



# CampusHub — University Workspace

A responsive, installable university workspace combining the full private Campus calendar with a OneNote-style academic notes editor. It supports separate accounts for Hochschule Wismar and Hochschule Worms, with each account's schedule isolated from the other.

## Run locally

Serve this folder from any static web server, then open its URL in a browser. A server is needed for PWA installation and offline caching; the app itself is plain HTML, CSS, and JavaScript.


## CampusHub v64 — Subject Management

The Overview page is rebuilt as an interactive campus command center inspired by the approved dashboard direction.

- Live Wismar weather using the Open-Meteo forecast API (no browser API key required).
- Current/next class card with live status, countdown, room, and in-class progress.
- Interactive today schedule with live class highlighting and progress.
- Clickable stats for Calendar, Planner, and Exams.
- Study planner attention list with direct event details.
- Quick actions for events, notes, assignments, and exams.
- Interactive week day selector with inline schedule details; the full-width week panel is placed immediately after Today’s schedule.
- Interactive next-seven-days selector with inline schedule details; the panel is directly below This week.
- Responsive mobile layout.
- Weather is fetched client-side from Wismar coordinates and does not require storing a weather credential.

## Included

- Dashboard with today’s schedule, next class, exam countdown, deadlines, and weekly overview
- Day, week, and month calendar views
- Add, edit, and delete events, including notes and recurrence (weekly, every two weeks, monthly)
- CSV and iCalendar (`.ics`) timetable import with a comparison preview for new, changed, unchanged, and missing classes; missing entries are kept unless removal is explicitly selected
- JSON backup download and restore, plus `.ics` export for common calendar apps
- Email-and-password sign-in and account creation, backed by Supabase Auth
- Private per-account calendar sync, protected by PostgreSQL row-level security
- Event types and colors for lectures, exams, assignments, university events, holidays, and deadlines
- Local browser storage and a service worker for app-shell offline access
- Responsive layout and PWA manifest
- Search and event-type filtering across the calendar
- Series-level and single-occurrence editing/deletion for repeating events
- Study planner with task completion and one-click study-session plans
- Twelve-week workload overview, tight travel-gap notices, and account-specific preferences
- Optional browser reminders while the app is open

Each account starts with its own private calendar. Each person creates a separate account and chooses their university; calendars are private and never shared between accounts. Email addresses are the sign-in names. The app does not create accounts or store passwords itself.

### Connect Supabase for online accounts

The app-side auth flow is ready, but online accounts need a Supabase project. Until configured, the sign-in screen explains what is missing.

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase-schema.sql`](supabase-schema.sql) to create the private calendar table and owner-only row-level security policies.
3. In Supabase project settings, enable email/password sign-in. Email confirmation may be enabled; if so, each person confirms their email before signing in.
4. Copy the project URL and the public publishable/anon key into [`supabase-config.js`](supabase-config.js). Never use a `service_role` or secret key in this browser app.
5. In Supabase Auth URL Configuration, set the deployed app URL as the Site URL and add it to the redirect allow list. Serve this folder over HTTPS (localhost is also supported for development).
6. Both people open the same hosted app, create their own account, and select Hochschule Wismar or Hochschule Worms.

After sign-in, the app keeps a local per-account cache for offline viewing and syncs calendar changes to that account's private cloud row when online. It does not provide a password reset email template or cross-account sharing yet. Email/password login is provided by Supabase Auth; database access is restricted by `auth.uid()` policies.

Choose **Calendar → Import timetable** to compare a CSV or `.ics` schedule. New and changed classes are selected by default. Missing classes from that imported file are listed and kept unless you explicitly choose to remove them; unrelated hand-entered events and other import types are never removed. CSV accepts comma- or semicolon-delimited files with `Date`, `Beginning`/`Start`, and `End` columns. iCalendar imports include event titles, dates, times, locations, lecturers in parentheses, descriptions, and supported weekly recurrence rules with exclusions. Use **Export / backup** to download a restorable JSON backup or an `.ics` calendar file. Restoring a JSON backup replaces the events currently saved for the signed-in account. Notification reminders appear while the web app is open; browser background push is not configured.

## Data architecture

Events use a plain JSON shape. Local caches are namespaced by authenticated user ID; the Supabase `campus_calendars` row is also keyed by that ID and protected with row-level security. The calendar UI and CSV importer operate on the active account's event list, so adding another institution or an import format does not require changing the authentication boundary.


## Notes workspace

CampusHub now includes a OneNote-style editor under **Notes** with Home and Insert ribbons, rich text formatting, headings, lists, checkboxes, tags, tables, pictures, attachments, audio/video, links, symbols, equations, dictation, zoom, printing, and autosave. Notes are namespaced by the signed-in Supabase user in browser storage. The included SQL also creates `campus_notes` with owner-only RLS if you want to extend cloud sync.


### Notes editor interaction fix
The Notes UI loads its functional OneNote-style Home/Insert ribbon and subject/page interactions from `notes-ui.js`.

## CampusHub v28 — Cloud Sync

v28 adds cross-device persistence using the existing Supabase project.

### One-time Supabase setup

1. Open the Supabase SQL Editor for the project configured in `supabase-config.js`.
2. Run the complete `supabase-schema.sql` file.
3. In Supabase Authentication, enable Email/Password sign-in.
4. If email confirmation is enabled, users must confirm their email before the first sign-in.
5. Deploy the `src` folder as before. The browser uses the publishable/anon key only; never place a `service_role` key in `supabase-config.js`.

### What syncs in v28

- Private calendar data
- OneNote-style Subjects → Topics → Pages
- Assignment Workspaces
- Exam Workspaces
- Quick Notes
- Per-account settings/profile metadata
- Realtime updates for the cloud-synced modules when Supabase Realtime is enabled

The existing local data is retained as a cache. When an account signs in, CampusHub migrates the old `:local` browser cache when present, then hydrates the account from Supabase. If cloud data does not exist yet, the local account data is uploaded.

### Security model

All cloud rows are protected with Row Level Security and are keyed to `auth.users.id`. A signed-in user can only read/write their own data. The private `campushub-files` Storage bucket and its object policies are included for future large attachment uploads.


## CampusHub v72 — Floating Glass Sidebar

- Sidebar rebuilt to match the approved reference: floating rounded glass surface, translucent background, compact line icons, and clean vertical navigation.
- Navigation order: Overview, Calendar, Notes, Study planner, Assignments, Exams, Files, Settings.
- Removed the visual Categories and timetable blocks from the sidebar; underlying category data remains available to the calendar.
- Profile is reduced to avatar, name, and student/university context.
- Assignments routes to the existing Study Planner workflow; Files routes to the Notes Files workspace.
- Mobile uses the same floating drawer treatment instead of a full-height solid sidebar.
