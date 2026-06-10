
-- 1. Remove streak
ALTER TABLE public.profiles DROP COLUMN IF EXISTS streak_days;

-- 2. Rooms: custom timer
ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS focus_duration_minutes INT NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS break_duration_minutes INT NOT NULL DEFAULT 5;

-- 3. Groups: invite_code
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex');
UPDATE public.groups SET invite_code = encode(gen_random_bytes(6),'hex') WHERE invite_code IS NULL;

-- 4. Group invitations
CREATE TABLE IF NOT EXISTS public.group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invitations TO authenticated;
GRANT ALL ON public.group_invitations TO service_role;

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group admins manage invitations"
  ON public.group_invitations FOR ALL TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()))
  WITH CHECK (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Invited users can read their invitations"
  ON public.group_invitations FOR SELECT TO authenticated
  USING (invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- 5. Quiz attempts table (ensure exists with needed columns)
-- Already exists per context; ensure columns
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 6. Storage bucket created via tool separately
