REVOKE EXECUTE ON FUNCTION public.auto_approve_flight_plans() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_atc_banned(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_atc_banned(uuid) TO authenticated, service_role;