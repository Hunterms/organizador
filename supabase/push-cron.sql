-- Schedules the two push jobs. pg_cron runs in UTC.
-- America/Sao_Paulo = UTC-3 (no DST since 2019), so 07:30 local = 10:30 UTC.
--
-- Placeholders substituted at deploy time (never commit the real values):
--   __ANON_KEY__   = project anon key (public)
--   __CRON_SECRET__ = the CRON_SECRET edge-function secret

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('push-digest') where exists (select 1 from cron.job where jobname = 'push-digest');
select cron.unschedule('push-timed')  where exists (select 1 from cron.job where jobname = 'push-timed');

-- Morning digest — 07:30 America/Sao_Paulo
select cron.schedule('push-digest', '30 10 * * *', $$
  select net.http_post(
    url := 'https://cijuivijuxyrdlvlkulp.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__', 'apikey', '__ANON_KEY__'),
    body := jsonb_build_object('cron', '__CRON_SECRET__', 'job', 'digest')
  );
$$);

-- Timed-task reminders — every 10 minutes
select cron.schedule('push-timed', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://cijuivijuxyrdlvlkulp.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__', 'apikey', '__ANON_KEY__'),
    body := jsonb_build_object('cron', '__CRON_SECRET__', 'job', 'timed')
  );
$$);
