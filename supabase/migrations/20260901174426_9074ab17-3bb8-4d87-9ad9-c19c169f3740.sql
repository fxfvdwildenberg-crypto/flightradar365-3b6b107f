-- App code never calls this helper from the client; keep it server-side only.
REVOKE ALL ON FUNCTION public.is_atc_banned(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_atc_banned(uuid) TO service_role;