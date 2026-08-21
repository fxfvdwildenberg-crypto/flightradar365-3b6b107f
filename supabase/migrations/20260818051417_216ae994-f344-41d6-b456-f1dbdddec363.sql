CREATE TYPE public.app_role AS ENUM ('admin', 'atc', 'pilot');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Pilot',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.flight_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callsign text NOT NULL,
  airline text,
  aircraft text NOT NULL DEFAULT 'A320',
  dep_icao text NOT NULL,
  arr_icao text NOT NULL,
  dep_time timestamptz NOT NULL,
  arr_time timestamptz NOT NULL,
  cruise_alt integer NOT NULL DEFAULT 30000,
  route text,
  status text NOT NULL DEFAULT 'filed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.flight_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_plans TO authenticated;
GRANT ALL ON public.flight_plans TO service_role;
ALTER TABLE public.flight_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Flight plans are public" ON public.flight_plans FOR SELECT USING (true);
CREATE POLICY "Users create their own flight plans" ON public.flight_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own flight plans" ON public.flight_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own flight plans" ON public.flight_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_flight_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.arr_time <= NEW.dep_time THEN
    RAISE EXCEPTION 'Arrival time must be after departure time';
  END IF;
  NEW.callsign := upper(NEW.callsign);
  NEW.dep_icao := upper(NEW.dep_icao);
  NEW.arr_icao := upper(NEW.arr_icao);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER flight_plans_validate BEFORE INSERT OR UPDATE ON public.flight_plans
FOR EACH ROW EXECUTE FUNCTION public.validate_flight_plan();

CREATE TABLE public.atis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_icao text NOT NULL,
  letter text NOT NULL DEFAULT 'A',
  runway_in_use text,
  wind text,
  visibility text,
  clouds text,
  temperature text,
  qnh text,
  remarks text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.atis TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis TO authenticated;
GRANT ALL ON public.atis TO service_role;
ALTER TABLE public.atis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ATIS is public" ON public.atis FOR SELECT USING (true);

CREATE INDEX idx_atis_airport ON public.atis (airport_icao, active);
CREATE INDEX idx_flight_plans_times ON public.flight_plans (dep_time, arr_time);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'pilot')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_flight_plan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

ALTER TABLE public.flight_plans ALTER COLUMN user_id DROP NOT NULL;

INSERT INTO public.flight_plans (user_id, callsign, airline, aircraft, dep_icao, arr_icao, dep_time, arr_time, cruise_alt, route, status) VALUES
  (NULL, 'BAW4723', 'British Airways', 'A320', 'IRFD', 'ILAR', now() - interval '22 minutes', now() + interval '18 minutes', 34000, 'DCT ALPHA DCT', 'active'),
  (NULL, 'QFA32', 'Qantas', '747-400', 'IPPH', 'IRFD', now() - interval '40 minutes', now() + interval '9 minutes', 38000, 'DCT', 'active'),
  (NULL, 'DLH121', 'Lufthansa', 'A350', 'ITKO', 'IPPH', now() - interval '12 minutes', now() + interval '33 minutes', 36000, 'DCT KILO DCT', 'active'),
  (NULL, 'FDX80', 'FedEx', 'MD11', 'IKFL', 'IRFD', now() - interval '5 minutes', now() + interval '41 minutes', 32000, 'DCT', 'active'),
  (NULL, 'SAR07', 'Island SAR', '412 Rescue', 'IRCG', 'IMLR', now() - interval '8 minutes', now() + interval '14 minutes', 4000, 'COASTAL', 'active'),
  (NULL, 'UAL998', 'United', 'Boeing 787-9', 'ILAR', 'IPPH', now() + interval '14 minutes', now() + interval '68 minutes', 37000, 'DCT', 'filed'),
  (NULL, 'CEBU46L', 'Cebu', 'ATR 72', 'IMLR', 'IRFD', now() + interval '6 minutes', now() + interval '29 minutes', 12000, 'DCT', 'filed'),
  (NULL, 'RYN39W', 'Ryan Air', 'Boeing 737', 'IZOL', 'IKFL', now() - interval '35 minutes', now() + interval '25 minutes', 35000, 'DCT ZULU DCT', 'active');

INSERT INTO public.atis (airport_icao, letter, runway_in_use, wind, visibility, clouds, temperature, qnh, remarks) VALUES
  ('IRFD', 'C', '27L', '250/12KT', '10KM', 'FEW030 SCT090', '18/12', '1013', 'Expect ILS approach runway 27L. Contact ground on pushback.'),
  ('IPPH', 'B', '06', '070/08KT', 'CAVOK', 'NIL', '24/09', '1018', 'Visual approaches in use. Birds reported near threshold 06.'),
  ('ILAR', 'A', '22', '200/15KT G22', '8KM', 'BKN025', '21/16', '1009', 'Moderate turbulence reported on final. Caution wake turbulence.');

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

ALTER TABLE public.atis ADD COLUMN IF NOT EXISTS spoken_text text;

ALTER TABLE public.flight_plans ADD COLUMN IF NOT EXISTS cruise_speed integer NOT NULL DEFAULT 450;

CREATE POLICY "Users manage own atc sessions" ON public.atc_sessions FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

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

CREATE TABLE public.acars_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_plan_id uuid NOT NULL REFERENCES public.flight_plans(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name text NOT NULL DEFAULT 'Pilot',
  sender_role text NOT NULL DEFAULT 'pilot',
  label text NOT NULL DEFAULT 'MSG',
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.acars_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acars_messages TO authenticated;
GRANT ALL ON public.acars_messages TO service_role;

ALTER TABLE public.acars_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ACARS messages are public" ON public.acars_messages FOR SELECT USING (true);
CREATE POLICY "Users send own ACARS" ON public.acars_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users delete own ACARS" ON public.acars_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX acars_messages_flight_idx ON public.acars_messages (flight_plan_id, created_at DESC);