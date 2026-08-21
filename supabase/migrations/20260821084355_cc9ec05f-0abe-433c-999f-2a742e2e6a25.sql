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