CREATE OR REPLACE FUNCTION public.random_squawk()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT string_agg(floor(random()*8)::int::text, '') FROM generate_series(1,4);
$$;
REVOKE EXECUTE ON FUNCTION public.auto_approve_flight_plans() FROM anon, authenticated, public;