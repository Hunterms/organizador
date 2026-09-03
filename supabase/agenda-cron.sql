-- ==========================================================================
-- Cron do sync-agenda. pg_cron roda em UTC.
-- America/Sao_Paulo = UTC-3 (sem horario de verao desde 2019).
--
-- Placeholders substituidos na hora de rodar (nunca comitar os valores reais):
--   __ANON_KEY__    = anon key do projeto (publica)
--   __CRON_SECRET__ = o mesmo secret que o send-push usa
--
-- DUAS RODADAS, e por que:
--   06:50 local -> antes do digest das 07:30, pra reuniao do dia ja estar na
--                  lista quando o push chegar. Este e o horario que resolve a
--                  adesao: ele acorda as 7 e o dia dele ja comeca com trabalho.
--   12:50 local -> pega reuniao marcada de manha pra tarde, que e o caso comum.
--
-- TETO CONHECIDO: o sync so INSERE. Reuniao cancelada ou movida depois da
-- importacao continua na lista como tarefa. Reconciliar exigiria apagar tarefa
-- que ele talvez ja tenha fechado, e o risco de apagar trabalho registrado e
-- pior que o de uma linha velha. Se virar problema medido, o caminho e marcar
-- a tarefa como cancelada em vez de apagar.
-- ==========================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('agenda-manha') where exists (select 1 from cron.job where jobname = 'agenda-manha');
select cron.unschedule('agenda-tarde') where exists (select 1 from cron.job where jobname = 'agenda-tarde');

-- 06:50 America/Sao_Paulo = 09:50 UTC
select cron.schedule('agenda-manha', '50 9 * * *', $$
  select net.http_post(
    url := 'https://cijuivijuxyrdlvlkulp.supabase.co/functions/v1/sync-agenda',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__', 'apikey', '__ANON_KEY__'),
    body := jsonb_build_object('cron', '__CRON_SECRET__')
  );
$$);

-- 12:50 America/Sao_Paulo = 15:50 UTC
select cron.schedule('agenda-tarde', '50 15 * * *', $$
  select net.http_post(
    url := 'https://cijuivijuxyrdlvlkulp.supabase.co/functions/v1/sync-agenda',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__', 'apikey', '__ANON_KEY__'),
    body := jsonb_build_object('cron', '__CRON_SECRET__')
  );
$$);

-- Conferir depois de rodar:
--   select jobname, schedule, active from cron.job order by jobname;
--   select agenda_last_synced_at, agenda_last_error from public.profiles;
--   select time, title, effort, place from public.tasks
--     where source = 'work_calendar' and date = current_date order by time;
