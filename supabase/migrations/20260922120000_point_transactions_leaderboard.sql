-- Modelo de puntos basado en participación (reemplaza el flat +100 / -20 por sesión)
-- La participación se deriva de room_participants.joined_at/left_at ya existentes
-- (no hay heartbeats en este proyecto), acotada a la duración planeada de la sesión.

CREATE TYPE public.point_source_type AS ENUM ('SESSION');
CREATE TYPE public.point_reason AS ENUM ('SESSION_PARTICIPATION');

CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  source_type public.point_source_type NOT NULL,
  source_id UUID NOT NULL,
  reason public.point_reason NOT NULL,
  points INT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, source_id, reason)
);
GRANT SELECT ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Un usuario ve sus propias transacciones (aunque haya dejado el grupo) y las
-- de cualquier grupo del que sea miembro activo (para el leaderboard).
CREATE POLICY "pt_select_own_or_group_member" ON public.point_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));

-- Mantener profiles.total_points en sync, igual que con point_events.
CREATE OR REPLACE FUNCTION public.handle_point_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET total_points = total_points + NEW.points WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_point_transaction AFTER INSERT ON public.point_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_point_transaction();

-- Materialización lazy de puntos de sesiones ya finalizadas (planned end <= now)
-- para las participaciones todavía no evaluadas de un grupo. Idempotente vía
-- UNIQUE + ON CONFLICT DO NOTHING (tolera llamadas concurrentes sin error).
CREATE OR REPLACE FUNCTION public.award_pending_session_points(p_group_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NOT public.is_group_member(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of this group' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.point_transactions (user_id, group_id, source_type, source_id, reason, points, earned_at)
  SELECT
    pending.user_id,
    pending.group_id,
    'SESSION',
    pending.session_id,
    'SESSION_PARTICIPATION',
    ROUND(
      (pending.duration_seconds / 60.0) *
      CASE
        WHEN pending.present_seconds >= pending.duration_seconds * 0.85 THEN 1.5
        WHEN pending.present_seconds >= pending.duration_seconds * 0.5 THEN 1.0
        WHEN pending.present_seconds >= pending.duration_seconds * 0.2 THEN 0.5
        ELSE 0
      END
    )::INT,
    pending.planned_ends_at
  FROM (
    SELECT
      rp.user_id,
      r.group_id,
      s.id AS session_id,
      s.duration_seconds,
      s.started_at + (s.duration_seconds || ' seconds')::interval AS planned_ends_at,
      GREATEST(0, EXTRACT(EPOCH FROM (
        LEAST(COALESCE(rp.left_at, v_now), s.started_at + (s.duration_seconds || ' seconds')::interval)
        - GREATEST(rp.joined_at, s.started_at)
      ))) AS present_seconds
    FROM public.room_participants rp
    JOIN public.rooms r ON r.id = rp.room_id
    JOIN public.sessions s ON s.room_id = r.id
    WHERE r.group_id = p_group_id
      AND s.started_at + (s.duration_seconds || ' seconds')::interval <= v_now
      AND NOT EXISTS (
        SELECT 1 FROM public.point_transactions pt
        WHERE pt.user_id = rp.user_id
          AND pt.source_type = 'SESSION'
          AND pt.source_id = s.id
          AND pt.reason = 'SESSION_PARTICIPATION'
      )
  ) pending
  ON CONFLICT (user_id, source_type, source_id, reason) DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION public.award_pending_session_points(UUID) TO authenticated;

-- Ya no se otorgan puntos flat de sesión ni penalización por abandono vía point_events;
-- restringimos el insert de point_events a quiz_score (única fuente que sigue viva ahí).
DROP POLICY IF EXISTS "pe_insert_self" ON public.point_events;
CREATE POLICY "pe_insert_self_quiz_only" ON public.point_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND type = 'quiz_score');
