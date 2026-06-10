
CREATE POLICY "Group members can read study files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'study-files' AND
    public.is_group_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "Group members can upload study files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'study-files' AND
    public.is_group_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "Group members can delete their study files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'study-files' AND owner = auth.uid()
  );
