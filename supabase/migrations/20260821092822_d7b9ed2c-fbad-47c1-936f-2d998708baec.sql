CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  flight_plan_id uuid REFERENCES public.flight_plans(id) ON DELETE SET NULL,
  last_phase text,
  last_emergency boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS push_subscriptions_flight_idx ON public.push_subscriptions(flight_plan_id);

CREATE TABLE IF NOT EXISTS public.atc_bans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  banned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.atc_bans TO authenticated;
GRANT ALL ON public.atc_bans TO service_role;
ALTER TABLE public.atc_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view ATC bans" ON public.atc_bans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage ATC bans" ON public.atc_bans FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_atc_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.atc_bans WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_atc_banned(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_atc_banned(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users manage own atc sessions" ON public.atc_sessions;
CREATE POLICY "Users manage own atc sessions" ON public.atc_sessions FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'))
    OR (auth.uid() = user_id AND NOT public.is_atc_banned(auth.uid()))
  );

DROP POLICY IF EXISTS "Users send own ACARS" ON public.acars_messages;
CREATE POLICY "Pilots send ACARS on their own flight" ON public.acars_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM public.flight_plans fp WHERE fp.id = flight_plan_id AND fp.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.random_squawk()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT string_agg(floor(random()*8)::int::text, '') FROM generate_series(1,4);
$$;

CREATE OR REPLACE FUNCTION public.auto_approve_flight_plans()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.flight_plans
     SET atc_status = 'approved',
         squawk = public.random_squawk(),
         atc_note = COALESCE(atc_note, 'Auto-approved after 5 minutes'),
         updated_at = now()
   WHERE atc_status = 'pending'
     AND created_at < now() - interval '5 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.auto_approve_flight_plans() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.auto_approve_flight_plans() TO service_role;

ALTER TABLE public.flight_plans ALTER COLUMN atc_status SET DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.tfrs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  reason text,
  points jsonb NOT NULL,
  allowed_callsigns text[] NOT NULL DEFAULT '{}',
  min_alt integer NOT NULL DEFAULT 0,
  max_alt integer NOT NULL DEFAULT 60000,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT now() + interval '6 hours'
);
GRANT SELECT ON public.tfrs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tfrs TO authenticated;
GRANT ALL ON public.tfrs TO service_role;
ALTER TABLE public.tfrs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active TFRs are public" ON public.tfrs;
CREATE POLICY "Active TFRs are public" ON public.tfrs FOR SELECT USING (expires_at > now());
DROP POLICY IF EXISTS "Admins manage TFRs" ON public.tfrs;
CREATE POLICY "Admins manage TFRs" ON public.tfrs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_tfr()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tfrs_touch ON public.tfrs;
CREATE TRIGGER tfrs_touch BEFORE UPDATE ON public.tfrs
FOR EACH ROW EXECUTE FUNCTION public.touch_tfr();

ALTER TABLE public.flight_plans
  ADD COLUMN IF NOT EXISTS flight_rules text NOT NULL DEFAULT 'IFR',
  ADD COLUMN IF NOT EXISTS flight_type text NOT NULL DEFAULT 'S',
  ADD COLUMN IF NOT EXISTS aircraft_icao text,
  ADD COLUMN IF NOT EXISTS registration text,
  ADD COLUMN IF NOT EXISTS remarks text;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
SELECT cron.schedule('auto-approve-flight-plans', '* * * * *', $$SELECT public.auto_approve_flight_plans();$$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-approve-flight-plans');