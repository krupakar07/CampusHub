-- CampusHub Files & Materials migration
-- Run this once in Supabase SQL Editor on an existing CampusHub project.
alter table public.campus_user_data drop constraint if exists campus_user_data_namespace_check;
alter table public.campus_user_data add constraint campus_user_data_namespace_check
  check (namespace in ('notes','assignments','exams','quick-notes','files'));

insert into storage.buckets (id, name, public)
values ('campushub-files','campushub-files',false)
on conflict (id) do nothing;

-- Private per-user Storage policies
create policy if not exists "Users can read their own CampusHub files"
  on storage.objects for select to authenticated
  using (bucket_id='campushub-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy if not exists "Users can upload their own CampusHub files"
  on storage.objects for insert to authenticated
  with check (bucket_id='campushub-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy if not exists "Users can update their own CampusHub files"
  on storage.objects for update to authenticated
  using (bucket_id='campushub-files' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='campushub-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy if not exists "Users can delete their own CampusHub files"
  on storage.objects for delete to authenticated
  using (bucket_id='campushub-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
