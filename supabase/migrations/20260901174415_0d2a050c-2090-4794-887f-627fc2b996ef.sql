-- 1. Ban records: only the banned user or admins can read them
DROP POLICY IF EXISTS "Authenticated can view ATC bans" ON public.atc_bans;
CREATE POLICY "Own or admin can view ATC bans"
ON public.atc_bans FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. Controller sessions: no longer world-readable
DROP POLICY IF EXISTS "ATC sessions are public" ON public.atc_sessions;
CREATE POLICY "Signed-in users can view ATC sessions"
ON public.atc_sessions FOR SELECT TO authenticated
USING (true);
REVOKE SELECT ON public.atc_sessions FROM anon;

-- 3. SECURITY DEFINER hardening: is_atc_banned only reveals own status (or admin)
CREATE OR REPLACE FUNCTION public.is_atc_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN NULL
    ELSE EXISTS (SELECT 1 FROM public.atc_bans WHERE user_id = _user_id)
  END
$$;
REVOKE ALL ON FUNCTION public.is_atc_banned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_atc_banned(uuid) TO authenticated, service_role;

-- has_role must remain executable by authenticated: RLS policies call it as the
-- querying role. It only reads role rows for the id passed in.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;