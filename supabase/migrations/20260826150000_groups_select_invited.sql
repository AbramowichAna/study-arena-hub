
-- Let an invited (not-yet-member) user read the group's name for their pending invitation
CREATE POLICY "groups_select_invited" ON public.groups FOR SELECT TO authenticated
USING (
  id IN (
    SELECT group_id FROM public.group_invitations
    WHERE invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    AND status = 'pending'
  )
);
