
-- Number of focus+break cycles in a session. Controls the total session duration:
-- total = (focus_duration_minutes + break_duration_minutes) * cycles
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS cycles INTEGER NOT NULL DEFAULT 3;
