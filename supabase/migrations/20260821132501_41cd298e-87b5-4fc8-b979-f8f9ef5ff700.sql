CREATE OR REPLACE FUNCTION public.delete_landed_flight_plans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE removed integer;
BEGIN
  WITH gone AS (
    DELETE FROM public.flight_plans
    WHERE arr_time < now()
    RETURNING id
  )
  SELECT count(*) INTO removed FROM gone;
  RETURN removed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_landed_flight_plans() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.delete_landed_flight_plans() TO service_role;

SELECT cron.schedule('delete-landed-flight-plans', '* * * * *', $$SELECT public.delete_landed_flight_plans();$$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-landed-flight-plans');