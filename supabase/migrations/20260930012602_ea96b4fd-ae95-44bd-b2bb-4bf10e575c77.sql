-- Shareable, regenerable group invite links (separate from the permanent groups.invite_code,
-- which stays in use by the existing "invite by searching a user" flow).
CREATE TABLE public.group_invite_links (
  group_id UUID PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.group_invite_links TO authenticated;
GRANT ALL ON public.group_invite_links TO service_role;

ALTER TABLE public.group_invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gil_select_admin" ON public.group_invite_links FOR SELECT TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "gil_insert_admin" ON public.group_invite_links FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "gil_update_admin" ON public.group_invite_links FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()));

-- Generates (or regenerates, invalidating the previous one) the link for a group.
-- Only the group's admin may call this.
CREATE OR REPLACE FUNCTION public.regenerate_group_invite_link(p_group_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT public.is_group_admin(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'not an admin of this group' USING ERRCODE = '42501';
  END IF;
  v_token := encode(gen_random_bytes(9), 'hex');
  INSERT INTO public.group_invite_links (group_id, token, created_by)
  VALUES (p_group_id, v_token, auth.uid())
  ON CONFLICT (group_id) DO UPDATE
    SET token = EXCLUDED.token, created_by = EXCLUDED.created_by, created_at = now();
  RETURN v_token;
END; $$;

GRANT EXECUTE ON FUNCTION public.regenerate_group_invite_link(UUID) TO authenticated;

-- Public preview for the /join/{token} page: works for anon and authenticated alike,
-- without requiring group membership. Returns no rows if the token doesn't resolve.
CREATE OR REPLACE FUNCTION public.get_group_invite_preview(p_token TEXT)
RETURNS TABLE(group_id UUID, group_name TEXT, member_count BIGINT, invited_by TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT g.id, g.name,
    (SELECT count(*) FROM public.group_members gm WHERE gm.group_id = g.id),
    p.name
  FROM public.group_invite_links gil
  JOIN public.groups g ON g.id = gil.group_id
  JOIN public.profiles p ON p.id = g.admin_id
  WHERE gil.token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_invite_preview(TEXT) TO anon, authenticated;

-- Joins the caller to the group behind a token. Idempotent: if already a member, just
-- returns the group id instead of erroring. Raises if the token doesn't resolve.
CREATE OR REPLACE FUNCTION public.join_group_via_invite_link(p_token TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT group_id INTO v_group_id FROM public.group_invite_links WHERE token = p_token;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'invite link not found';
  END IF;
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, auth.uid(), 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN v_group_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.join_group_via_invite_link(TEXT) TO authenticated;