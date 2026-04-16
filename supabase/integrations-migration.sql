-- ==========================================================================
-- Migration: Google Classroom + Moodle integration
-- Execute no Supabase SQL Editor
-- ==========================================================================

-- Link subject a um curso do Classroom
alter table public.subjects
  add column if not exists classroom_course_id text,
  add column if not exists moodle_course_id text;

-- Dedup tasks importadas do Classroom
alter table public.tasks
  add column if not exists classroom_coursework_id text,
  add column if not exists source text default 'manual' check (source in ('manual','classroom','moodle'));

create index if not exists tasks_classroom_id_idx on public.tasks(user_id, classroom_coursework_id)
  where classroom_coursework_id is not null;

-- Link exam a assignment do Classroom (quando for prova)
alter table public.exams
  add column if not exists classroom_coursework_id text,
  add column if not exists source text default 'manual' check (source in ('manual','classroom','moodle'));

-- Tracking de syncs
alter table public.profiles
  add column if not exists classroom_last_synced_at timestamptz,
  add column if not exists moodle_ical_url text,
  add column if not exists moodle_last_synced_at timestamptz;
