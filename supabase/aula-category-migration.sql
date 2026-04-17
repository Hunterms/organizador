-- ==========================================================================
-- Migration: Add 'aula' category + companion task link
-- Enables automatic generation of "pegar circular" companion tasks for
-- class tasks, with a back-reference so deleting the class cleans up
-- the bus reminder.
-- ==========================================================================

-- Add 'aula' to the allowed categories
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check
  check (category in ('estudos','trabalho','terreiro','pessoal','casa','aula'));

-- Link a companion task (e.g. the circular reminder) to its parent (aula).
-- ON DELETE SET NULL keeps the companion task around if you delete the
-- parent manually, but it stops being linked.
alter table public.tasks
  add column if not exists companion_task_id uuid references public.tasks(id) on delete set null;

create index if not exists tasks_companion_idx on public.tasks(companion_task_id) where companion_task_id is not null;
