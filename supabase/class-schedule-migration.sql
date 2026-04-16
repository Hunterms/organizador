-- ==========================================================================
-- Migration: Class schedule (horario de aulas semanal) + recurring class tasks
-- Execute no Supabase SQL Editor
-- ==========================================================================

-- 1. Add class_schedule column to subjects
-- Format: [{ day: 0-6, time: 'HH:MM', duration: 120, room: 'XYZ' }]
-- day: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
alter table public.subjects
  add column if not exists class_schedule jsonb default '[]'::jsonb;

-- 2. Add 'class' as valid source for tasks
alter table public.tasks drop constraint if exists tasks_source_check;
alter table public.tasks add constraint tasks_source_check
  check (source in ('manual','classroom','moodle','work_calendar','class'));

-- 3. Unique index for idempotent inserts (prevents duplicate class tasks)
create unique index if not exists tasks_user_external_unique
  on public.tasks(user_id, classroom_coursework_id)
  where classroom_coursework_id is not null;
