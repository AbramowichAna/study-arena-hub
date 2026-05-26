
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  total_points INT NOT NULL DEFAULT 0,
  streak_days INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- GROUPS
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text),1,8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- GROUP MEMBERS
CREATE TYPE public.member_role AS ENUM ('admin','member');
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_group UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user);
$$;
CREATE OR REPLACE FUNCTION public.is_group_admin(_group UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user AND role = 'admin');
$$;

CREATE POLICY "groups_select_members" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "groups_insert_auth" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "groups_update_admin" ON public.groups FOR UPDATE TO authenticated
  USING (public.is_group_admin(id, auth.uid()));
CREATE POLICY "groups_delete_admin" ON public.groups FOR DELETE TO authenticated
  USING (public.is_group_admin(id, auth.uid()));

CREATE POLICY "gm_select_members" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "gm_insert_self" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "gm_delete_self_or_admin" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

-- Auto-add creator as admin member
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members(group_id, user_id, role) VALUES (NEW.id, NEW.admin_id, 'admin');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_group_created AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- ROOMS
CREATE TYPE public.room_status AS ENUM ('waiting','active','finished');
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  status public.room_status NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_select_member" ON public.rooms FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "rooms_insert_member" ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "rooms_update_member" ON public.rooms FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

-- ROOM PARTICIPANTS
CREATE TABLE public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  points_earned INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'studying'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_participants TO authenticated;
GRANT ALL ON public.room_participants TO service_role;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_room_member(_room UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    JOIN public.group_members gm ON gm.group_id = r.group_id
    WHERE r.id = _room AND gm.user_id = _user
  );
$$;

CREATE POLICY "rp_select_room_member" ON public.room_participants FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "rp_insert_self" ON public.room_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "rp_update_self" ON public.room_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- SESSIONS
CREATE TYPE public.session_phase AS ENUM ('focus','break');
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  phase public.session_phase NOT NULL DEFAULT 'focus',
  duration_seconds INT NOT NULL DEFAULT 1500,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  timer_state TEXT NOT NULL DEFAULT 'running'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_select_member" ON public.sessions FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "sessions_insert_member" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "sessions_update_member" ON public.sessions FOR UPDATE TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

-- MESSAGES (chat)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_member" ON public.messages FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "messages_insert_self_member" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));

-- STUDY MATERIALS
CREATE TYPE public.material_type AS ENUM ('flashcard_set','quiz','file');
CREATE TABLE public.study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.material_type NOT NULL,
  subject TEXT,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_materials TO authenticated;
GRANT ALL ON public.study_materials TO service_role;
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mat_select_own_or_group" ON public.study_materials FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())));
CREATE POLICY "mat_insert_self" ON public.study_materials FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "mat_update_own" ON public.study_materials FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "mat_delete_own" ON public.study_materials FOR DELETE TO authenticated USING (user_id = auth.uid());

-- FLASHCARDS
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  "order" INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fc_select" ON public.flashcards FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.study_materials m WHERE m.id = material_id
    AND (m.user_id = auth.uid() OR (m.group_id IS NOT NULL AND public.is_group_member(m.group_id, auth.uid()))))
);
CREATE POLICY "fc_modify_owner" ON public.flashcards FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.study_materials m WHERE m.id = material_id AND m.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.study_materials m WHERE m.id = material_id AND m.user_id = auth.uid())
);

-- QUIZ QUESTIONS
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INT NOT NULL,
  "order" INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qq_select" ON public.quiz_questions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.study_materials m WHERE m.id = material_id
    AND (m.user_id = auth.uid() OR (m.group_id IS NOT NULL AND public.is_group_member(m.group_id, auth.uid()))))
);
CREATE POLICY "qq_modify_owner" ON public.quiz_questions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.study_materials m WHERE m.id = material_id AND m.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.study_materials m WHERE m.id = material_id AND m.user_id = auth.uid())
);

-- QUIZ ATTEMPTS
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_select" ON public.quiz_attempts FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.study_materials m WHERE m.id = material_id
    AND m.group_id IS NOT NULL AND public.is_group_member(m.group_id, auth.uid()))
);
CREATE POLICY "qa_insert_self" ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- POINT EVENTS
CREATE TYPE public.point_event_type AS ENUM ('session_complete','abandon_penalty','quiz_score');
CREATE TABLE public.point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.point_event_type NOT NULL,
  points INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.point_events TO authenticated;
GRANT ALL ON public.point_events TO service_role;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pe_select_all_auth" ON public.point_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "pe_insert_self" ON public.point_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Auto-update profile total_points
CREATE OR REPLACE FUNCTION public.handle_point_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET total_points = total_points + NEW.points WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_point_event AFTER INSERT ON public.point_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_point_event();

-- USER GOALS
CREATE TYPE public.goal_type AS ENUM ('daily_hours','weekly_sessions','weekly_quizzes');
CREATE TABLE public.user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.goal_type NOT NULL,
  target INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_goals TO authenticated;
GRANT ALL ON public.user_goals TO service_role;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ug_select_self" ON public.user_goals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ug_modify_self" ON public.user_goals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
