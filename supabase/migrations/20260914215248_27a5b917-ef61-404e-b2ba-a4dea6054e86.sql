CREATE TABLE public.live_aircraft (
  callsign text PRIMARY KEY,
  x double precision NOT NULL,
  y double precision NOT NULL,
  altitude integer NOT NULL DEFAULT 0,
  ground_speed integer NOT NULL DEFAULT 0,
  heading integer NOT NULL DEFAULT 0,
  flight_plan_id uuid REFERENCES public.flight_plans(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_aircraft TO anon;
GRANT SELECT ON public.live_aircraft TO authenticated;
GRANT ALL ON public.live_aircraft TO service_role;
ALTER TABLE public.live_aircraft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live aircraft are public" ON public.live_aircraft FOR SELECT TO public USING (true);