-- CampusHub v39 — Files & Materials Storage migration
-- Safe to run on an existing CampusHub database.

ALTER TABLE public.campus_user_data
DROP CONSTRAINT IF EXISTS campus_user_data_namespace_check;

ALTER TABLE public.campus_user_data
ADD CONSTRAINT campus_user_data_namespace_check
CHECK (
  namespace IN ('notes','assignments','exams','quick-notes','files')
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('campushub-files','campushub-files',false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Users can read their own CampusHub files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own CampusHub files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own CampusHub files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own CampusHub files" ON storage.objects;

CREATE POLICY "Users can read their own CampusHub files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'campushub-files'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users can upload their own CampusHub files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campushub-files'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users can update their own CampusHub files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'campushub-files'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'campushub-files'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users can delete their own CampusHub files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'campushub-files'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

SELECT 'CampusHub Files migration completed successfully.' AS status;
