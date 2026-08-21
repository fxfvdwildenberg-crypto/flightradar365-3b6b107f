ALTER TABLE public.flight_plans
  ADD COLUMN IF NOT EXISTS alternate_icao text,
  ADD COLUMN IF NOT EXISTS squawk text NOT NULL DEFAULT '2000',
  ADD COLUMN IF NOT EXISTS atc_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS atc_note text;

ALTER TABLE public.atis
  ADD COLUMN IF NOT EXISTS dew_point text,
  ADD COLUMN IF NOT EXISTS altimeter text,
  ADD COLUMN IF NOT EXISTS approaches text,
  ADD COLUMN IF NOT EXISTS notices text;

ALTER TABLE public.aircraft_images DROP CONSTRAINT IF EXISTS aircraft_images_pkey;
ALTER TABLE public.aircraft_images ADD COLUMN IF NOT EXISTS airline text NOT NULL DEFAULT '*';
ALTER TABLE public.aircraft_images ADD CONSTRAINT aircraft_images_pkey PRIMARY KEY (aircraft, airline);

CREATE TABLE IF NOT EXISTS public.airlines (
  name text PRIMARY KEY,
  icao text,
  iata text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.airlines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airlines TO authenticated;
GRANT ALL ON public.airlines TO service_role;
ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Airlines are public" ON public.airlines FOR SELECT USING (true);
CREATE POLICY "Admins manage airlines" ON public.airlines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.flight_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flight_plan_id uuid NOT NULL REFERENCES public.flight_plans(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, flight_plan_id)
);
GRANT SELECT, INSERT, DELETE ON public.flight_favorites TO authenticated;
GRANT ALL ON public.flight_favorites TO service_role;
ALTER TABLE public.flight_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.flight_favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.flight_views (
  flight_plan_id uuid NOT NULL REFERENCES public.flight_plans(id) ON DELETE CASCADE,
  viewer_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (flight_plan_id, viewer_key)
);
CREATE INDEX IF NOT EXISTS idx_flight_views_seen ON public.flight_views (flight_plan_id, seen_at);
GRANT SELECT, INSERT, UPDATE ON public.flight_views TO anon;
GRANT SELECT, INSERT, UPDATE ON public.flight_views TO authenticated;
GRANT ALL ON public.flight_views TO service_role;
ALTER TABLE public.flight_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Flight views are public" ON public.flight_views FOR SELECT USING (true);
CREATE POLICY "Anyone can record a view" ON public.flight_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can refresh a view" ON public.flight_views FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Controllers review flight plans" ON public.flight_plans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'atc') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'atc') OR public.has_role(auth.uid(), 'admin'));