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