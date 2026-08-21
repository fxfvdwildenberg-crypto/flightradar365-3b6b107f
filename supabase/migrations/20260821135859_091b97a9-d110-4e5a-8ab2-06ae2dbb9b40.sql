ALTER TABLE public.flight_plans
  ADD COLUMN IF NOT EXISTS nav_mode text NOT NULL DEFAULT 'vectors',
  ADD COLUMN IF NOT EXISTS waypoints text[] NOT NULL DEFAULT '{}'::text[];