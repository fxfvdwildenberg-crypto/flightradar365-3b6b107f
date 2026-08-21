
-- AIRPORTS -------------------------------------------------------------
CREATE TABLE public.airports (
  icao text PRIMARY KEY,
  iata text,
  name text NOT NULL,
  island text NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  runway integer NOT NULL DEFAULT 0,
  elevation integer NOT NULL DEFAULT 0,
  major boolean NOT NULL DEFAULT false,
  info text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.airports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airports TO authenticated;
GRANT ALL ON public.airports TO service_role;
ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Airports are public" ON public.airports FOR SELECT USING (true);
CREATE POLICY "Admins manage airports" ON public.airports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.airports (icao, iata, name, island, x, y, runway, elevation, major) VALUES
('IKFL','KFL','Keflavik International','grindavik',152,486,65,32,true),
('IPGY',NULL,'Pingeyri','grindavik',178,414,120,55,false),
('ITAV',NULL,'Tavaro Seabase','grindavik',196,442,0,4,false),
('IGCG',NULL,'Grindavik Coastguard','grindavik',128,452,90,12,false),
('IRFD','RFD','Rockford Airport','greater-rockford',442,716,80,3,true),
('IMLR','MLR','Mellor Airport','greater-rockford',330,654,40,21,true),
('IBTH',NULL,'Boltic Airfield','greater-rockford',400,686,130,44,false),
('IGRV',NULL,'Airbase Garry','greater-rockford',356,748,25,30,false),
('ITRC',NULL,'Training Centre','greater-rockford',470,782,100,18,false),
('IROD',NULL,'Road Base','greater-rockford',420,728,15,26,false),
('IWLO',NULL,'Waterloo','greater-rockford',428,660,70,61,false),
('IRCG',NULL,'Rockford Coastguard','greater-rockford',392,736,55,8,false),
('IPPH','PPH','Perth International','perth',630,296,95,47,true),
('ILKL',NULL,'Lukla','perth',672,322,20,940,false),
('ISAV',NULL,'Sea Haven','perth',700,282,145,15,false),
('IPCG',NULL,'Perth Coastguard','perth',652,348,75,6,false),
('ILAR','LAR','Larnaca International','cyprus',654,806,60,24,true),
('IPAP',NULL,'Paphos','cyprus',726,818,110,33,false),
('IBAR',NULL,'Barra','cyprus',700,858,30,12,false),
('IMCN',NULL,'McConnell','cyprus',664,878,85,41,false),
('IHEN',NULL,'Henstridge Airfield','cyprus',624,892,140,19,false),
('IZOL','ZOL','Izolirani Airport','izolirani',811,486,50,28,true),
('ITKO','TKO','Tokyo Airport','izolirani',842,462,130,11,true),
('IORE',NULL,'Orenji Airstrip','orenji',433,82,35,9,false),
('ISKP',NULL,'Skopelos Field','skopelos',691,629,100,22,false),
('IBAR2',NULL,'Saint Barthélemy','saint-barthelemy',549,452,70,14,false),
('IUSS',NULL,'USS Carrier','uss-carrier',344,334,10,0,false),
('IHMS',NULL,'HMS Carrier','hms-carrier',486,620,350,0,false),
('ISTH',NULL,'Sauthemptona','sauthemptona',128,766,0,0,false),
('IOIL',NULL,'Oil Rig','oil-rig',178,631,0,0,false);

-- ATC SESSIONS ---------------------------------------------------------
CREATE TABLE public.atc_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  airport_icao text NOT NULL,
  position text NOT NULL CHECK (position IN ('ground','tower','center')),
  roblox_username text,
  discord_username text,
  online boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, airport_icao, position)
);
GRANT SELECT ON public.atc_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atc_sessions TO authenticated;
GRANT ALL ON public.atc_sessions TO service_role;
ALTER TABLE public.atc_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ATC sessions are public" ON public.atc_sessions FOR SELECT USING (true);
CREATE POLICY "ATC manage own sessions" ON public.atc_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK ((auth.uid() = user_id AND (public.has_role(auth.uid(), 'atc') OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'admin'));

-- AIRCRAFT IMAGES ------------------------------------------------------
CREATE TABLE public.aircraft_images (
  aircraft text PRIMARY KEY,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.aircraft_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aircraft_images TO authenticated;
GRANT ALL ON public.aircraft_images TO service_role;
ALTER TABLE public.aircraft_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aircraft images are public" ON public.aircraft_images FOR SELECT USING (true);
CREATE POLICY "Admins manage aircraft images" ON public.aircraft_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ATIS spoken text -----------------------------------------------------
ALTER TABLE public.atis ADD COLUMN IF NOT EXISTS spoken_text text;
ALTER TABLE public.flight_plans ADD COLUMN IF NOT EXISTS cruise_speed integer NOT NULL DEFAULT 450;

DROP POLICY IF EXISTS "ATC manage own sessions" ON public.atc_sessions;
CREATE POLICY "Users manage own atc sessions" ON public.atc_sessions FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "ATC can create ATIS" ON public.atis;
DROP POLICY IF EXISTS "ATC can update ATIS" ON public.atis;
DROP POLICY IF EXISTS "ATC can delete ATIS" ON public.atis;
CREATE POLICY "Users create own ATIS" ON public.atis FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users update own ATIS" ON public.atis FOR UPDATE TO authenticated
  USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users delete own ATIS" ON public.atis FOR DELETE TO authenticated
  USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

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
