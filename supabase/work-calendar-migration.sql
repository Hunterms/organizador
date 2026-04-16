-- ==========================================================================
-- Migration: Work Calendar import (eventos do Google Calendar como tarefas)
-- Execute no Supabase SQL Editor
-- ==========================================================================

-- Update source check constraint para incluir 'work_calendar'
alter table public.tasks
  drop constraint if exists tasks_source_check;
alter table public.tasks
  add constraint tasks_source_check check (source in ('manual','classroom','moodle','work_calendar'));

-- Profile: lista de calendarios pra importar como tarefas
alter table public.profiles
  add column if not exists work_calendar_ids text[] default array[]::text[],
  add column if not exists work_last_synced_at timestamptz;

-- Index pra dedup eficiente de eventos importados
create index if not exists tasks_source_external_idx on public.tasks(user_id, source, classroom_coursework_id)
  where classroom_coursework_id is not null;
