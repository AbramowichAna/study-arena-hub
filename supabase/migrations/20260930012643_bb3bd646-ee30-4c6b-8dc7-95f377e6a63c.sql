-- Session points model: materialized points per finished room participation.
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  room_participant_id UUID NOT NULL REFERENCES public.room_participants(id) ON DELETE CASCADE UNIQUE,
  points INTEGER NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'SESSION',
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_select_member" ON public.point_transactions FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

-- Lazy materialization: awards +100 per participation in finished rooms of the group
-- that hasn't generated points yet. Idempotent via the UNIQUE(room_participant_id).
CREATE OR REPLACE FUNCTION public.award_pending_session_points(p_group_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_group_member(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of this group' USING ERRCODE = '42501';
  END IF;

  WITH ins AS (
    INSERT INTO public.point_transactions (user_id, group_id, room_participant_id, points, source_type)
    SELECT rp.user_id, r.group_id, rp.id, 100, 'SESSION'
    FROM public.room_participants rp
    JOIN public.rooms r ON r.id = rp.room_id
    WHERE r.group_id = p_group_id AND r.status = 'finished'
    ON CONFLICT (room_participant_id) DO NOTHING
    RETURNING user_id, points
  )
  UPDATE public.profiles p
  SET total_points = p.total_points + s.total
  FROM (SELECT user_id, sum(points) AS total FROM ins GROUP BY user_id) s
  WHERE p.id = s.user_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.award_pending_session_points(UUID) TO authenticated;