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
    url := 'https://project--72d9d40b-2f53-4e4d-b400-74dc3cca8031.lovable.app/api/public/push/flight-events',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);