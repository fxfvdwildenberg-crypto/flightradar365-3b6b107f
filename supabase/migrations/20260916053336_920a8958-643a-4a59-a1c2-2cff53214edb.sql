GRANT EXECUTE ON FUNCTION public.is_atc_banned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_atc_banned(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;