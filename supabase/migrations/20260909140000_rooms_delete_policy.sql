
-- Allow the room creator or the group's admin to delete a room
-- (e.g. cancel/borrar a scheduled session from the cards).
CREATE POLICY "rooms_delete_creator_or_admin" ON public.rooms FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_group_admin(group_id, auth.uid()));
