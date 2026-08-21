CREATE TABLE IF NOT EXISTS public.atc_bans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  banned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.atc_bans TO authenticated;
GRANT ALL ON public.atc_bans TO service_role;
ALTER TABLE public.atc_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view ATC bans" ON public.atc_bans;
CREATE POLICY "Authenticated can view ATC bans" ON public.atc_bans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage ATC bans" ON public.atc_bans;
CREATE POLICY "Admins manage ATC bans" ON public.atc_bans FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.random_squawk()
RETURNS text LANGUAGE sql VOLATILE AS $$
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
GRANT EXECUTE ON FUNCTION public.auto_approve_flight_plans() TO anon, authenticated, service_role;

SELECT cron.schedule('auto-approve-flight-plans', '* * * * *', $$SELECT public.auto_approve_flight_plans();$$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-approve-flight-plans');