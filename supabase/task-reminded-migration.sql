-- Timestamp of when a timed-task push reminder was sent, so the cron job
-- doesn't remind the same task twice. Null = not yet reminded.
alter table public.tasks add column if not exists reminded_at timestamptz;
