CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  flight_plan_id uuid REFERENCES public.flight_plans(id) ON DELETE SET NULL,
  last_phase text,
  last_emergency boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS push_subscriptions_flight_idx ON public.push_subscriptions(flight_plan_id);

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('atc365-flight-push-events') where exists (
  select 1 from cron.job where jobname = 'atc365-flight-push-events'
);

select cron.schedule(
  'atc365-flight-push-events',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://project--484eb376-5c37-4777-a19a-e187ad8f4a52.lovable.app/api/public/push/flight-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer fW2iFb-RuKPeTHRo0kFtkJ7h5uD2qWBS'
    ),
    body := '{}'::jsonb
  );
  $$
);