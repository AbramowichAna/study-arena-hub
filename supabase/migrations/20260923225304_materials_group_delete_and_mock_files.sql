-- Permitir borrar un material al autor o al owner/admin del grupo al que
-- pertenece (antes solo el autor podía borrarlo).
DROP POLICY IF EXISTS "mat_delete_own" ON public.study_materials;
CREATE POLICY "mat_delete_own_or_group_admin" ON public.study_materials FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (group_id IS NOT NULL AND public.is_group_admin(group_id, auth.uid()))
  );
