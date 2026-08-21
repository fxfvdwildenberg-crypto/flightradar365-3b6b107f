CREATE TABLE public.acars_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_plan_id uuid NOT NULL REFERENCES public.flight_plans(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name text NOT NULL DEFAULT 'Pilot',
  sender_role text NOT NULL DEFAULT 'pilot',
  label text NOT NULL DEFAULT 'MSG',
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.acars_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acars_messages TO authenticated;
GRANT ALL ON public.acars_messages TO service_role;

ALTER TABLE public.acars_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ACARS messages are public" ON public.acars_messages FOR SELECT USING (true);
CREATE POLICY "Users send own ACARS" ON public.acars_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users delete own ACARS" ON public.acars_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX acars_messages_flight_idx ON public.acars_messages (flight_plan_id, created_at DESC);