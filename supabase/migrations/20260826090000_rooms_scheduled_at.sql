
-- Allow scheduling a room/session for a future date instead of starting immediately
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
