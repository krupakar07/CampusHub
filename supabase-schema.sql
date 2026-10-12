-- Each signed-in account has exactly one private calendar row.
-- RLS policies below prevent one account from reading or changing another account's row.
create table if not exists public.campus_calendars (
  user_id uuid primary key references auth.users(id) on delete cascade,
  university text not null check (university in ('Hochschule Wismar', 'Hochschule Worms')),
  events jsonb not null default '[]'::jsonb check (jsonb_typeof(events) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.campus_calendars enable row level security;

revoke all on table public.campus_calendars from anon, authenticated;
grant select, insert, update, delete on table public.campus_calendars to authenticated;

drop policy if exists "Users can read their own campus calendar" on public.campus_calendars;
create policy "Users can read their own campus calendar"
  on public.campus_calendars for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own campus calendar" on public.campus_calendars;
create policy "Users can create their own campus calendar"
  on public.campus_calendars for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own campus calendar" on public.campus_calendars;
create policy "Users can update their own campus calendar"
  on public.campus_calendars for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own campus calendar" on public.campus_calendars;
create policy "Users can delete their own campus calendar"
  on public.campus_calendars for delete to authenticated
  using ((select auth.uid()) = user_id);


-- Private OneNote-style pages for the same signed-in accounts.
create table if not exists public.campus_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled note',
  subject text not null default 'General',
  html text not null default '<p><br></p>',
  updated_at timestamptz not null default now()
);

alter table public.campus_notes enable row level security;
revoke all on table public.campus_notes from anon, authenticated;
grant select, insert, update, delete on table public.campus_notes to authenticated;

drop policy if exists "Users can read their own campus notes" on public.campus_notes;
create policy "Users can read their own campus notes" on public.campus_notes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own campus notes" on public.campus_notes;
create policy "Users can create their own campus notes" on public.campus_notes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own campus notes" on public.campus_notes;
create policy "Users can update their own campus notes" on public.campus_notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own campus notes" on public.campus_notes;
create policy "Users can delete their own campus notes" on public.campus_notes for delete to authenticated using ((select auth.uid()) = user_id);

-- Cloud-synced application state for notes, assignments, exams and Quick Notes.
-- One row per signed-in user and module namespace keeps the client simple while
-- RLS still enforces strict per-account isolation.
create table if not exists public.campus_user_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  namespace text not null check (namespace in ('notes','assignments','exams','quick-notes')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, namespace)
);

alter table public.campus_user_data enable row level security;
revoke all on table public.campus_user_data from anon, authenticated;
grant select, insert, update, delete on table public.campus_user_data to authenticated;

drop policy if exists "Users can read their own application data" on public.campus_user_data;
create policy "Users can read their own application data"
  on public.campus_user_data for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own application data" on public.campus_user_data;
create policy "Users can create their own application data"
  on public.campus_user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own application data" on public.campus_user_data;
create policy "Users can update their own application data"
  on public.campus_user_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own application data" on public.campus_user_data;
create policy "Users can delete their own application data"
  on public.campus_user_data for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Storage bucket for future large attachments. Files remain private to the owner.
insert into storage.buckets (id, name, public) values ('campushub-files', 'campushub-files', false)
on conflict (id) do nothing;

drop policy if exists "Users can read their own CampusHub files" on storage.objects;
create policy "Users can read their own CampusHub files"
  on storage.objects for select to authenticated
  using (bucket_id = 'campushub-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload their own CampusHub files" on storage.objects;
create policy "Users can upload their own CampusHub files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'campushub-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can update their own CampusHub files" on storage.objects;
create policy "Users can update their own CampusHub files"
  on storage.objects for update to authenticated
  using (bucket_id = 'campushub-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'campushub-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own CampusHub files" on storage.objects;
create policy "Users can delete their own CampusHub files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'campushub-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Enable realtime updates so changes made on another signed-in device can appear without a reload.
alter publication supabase_realtime add table public.campus_user_data;
