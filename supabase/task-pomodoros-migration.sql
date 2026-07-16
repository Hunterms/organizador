-- Pomodoro-gated tasks. A task with required_pomodoros > 0 only counts as
-- "effectively done" (for streak/XP) once pomodoros_done reaches it.
alter table public.tasks add column if not exists required_pomodoros int not null default 0;
alter table public.tasks add column if not exists pomodoros_done int not null default 0;
