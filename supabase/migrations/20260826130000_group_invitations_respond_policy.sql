
-- Allow an invited user to accept/decline their own pending invitation
-- (previously only the group admin could mutate group_invitations rows)
CREATE POLICY "Invited users can respond to their invitations"
  ON public.group_invitations FOR UPDATE TO authenticated
  USING (invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));
