-- 1. ATC bans
CREATE TABLE IF NOT EXISTS public.atc_bans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  banned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.atc_bans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atc_bans TO authenticated;
GRANT ALL ON public.atc_bans TO service_role;
ALTER TABLE public.atc_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ATC bans are public" ON public.atc_bans FOR SELECT USING (true);
CREATE POLICY "Admins manage ATC bans" ON public.atc_bans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_atc_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.atc_bans WHERE user_id = _user_id)
$$;

-- 2. Banned users cannot open ATC sessions
DROP POLICY IF EXISTS "Users manage own atc sessions" ON public.atc_sessions;
CREATE POLICY "Users manage own atc sessions" ON public.atc_sessions FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'))
    OR (auth.uid() = user_id AND NOT public.is_atc_banned(auth.uid()))
  );

-- 3. ACARS may only be sent by the pilot who owns the flight plan
DROP POLICY IF EXISTS "Users send own ACARS" ON public.acars_messages;
CREATE POLICY "Pilots send ACARS on their own flight" ON public.acars_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM public.flight_plans fp WHERE fp.id = flight_plan_id AND fp.user_id = auth.uid())
  );

-- 4. Auto-approval of pending flight plans after 5 minutes
CREATE OR REPLACE FUNCTION public.auto_approve_flight_plans()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH upd AS (
    UPDATE public.flight_plans
    SET atc_status = 'approved',
        squawk = (SELECT string_agg((floor(random() * 8))::int::text, '') FROM generate_series(1, 4)),
        atc_note = COALESCE(atc_note, 'Auto-approved after 5 minutes without controller review.')
    WHERE atc_status = 'pending'
      AND created_at < now() - interval '5 minutes'
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_approve_flight_plans() FROM public;
GRANT EXECUTE ON FUNCTION public.auto_approve_flight_plans() TO anon, authenticated, service_role;

ALTER TABLE public.flight_plans ALTER COLUMN atc_status SET DEFAULT 'pending';