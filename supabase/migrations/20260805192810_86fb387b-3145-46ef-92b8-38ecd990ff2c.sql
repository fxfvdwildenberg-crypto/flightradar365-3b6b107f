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
CREATE POLICY "ATC can create ATIS" ON public.atis FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'atc') OR public.has_role(auth.uid(), 'admin')) AND auth.uid() = created_by);
CREATE POLICY "ATC can update ATIS" ON public.atis FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'atc') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'atc') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ATC can delete ATIS" ON public.atis FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'atc') OR public.has_role(auth.uid(), 'admin'));

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