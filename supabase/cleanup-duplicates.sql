-- ==========================================================================
-- Cleanup: Remove duplicate imported tasks/subjects/exams from prior bugs
-- Run this once in the Supabase SQL Editor.
-- ==========================================================================
-- Why:
--   Earlier versions of the import code could create multiple rows for the
--   same external id (classroom_coursework_id / classroom_course_id) if the
--   dedup fetch raced with the insert. This keeps the OLDEST row per group
--   (preserves the user's "done" state and original created_at) and deletes
--   the rest. Also enforces a UNIQUE constraint so it can't happen again.
-- ==========================================================================

-- ---- 1. Dedupe tasks by (user_id, classroom_coursework_id) ----------------
-- Keep oldest per (user_id, classroom_coursework_id). Only applies to imports.
with ranked_tasks as (
  select
    id,
    row_number() over (
      partition by user_id, classroom_coursework_id
      order by created_at asc, id asc
    ) as rn
  from public.tasks
  where classroom_coursework_id is not null
)
delete from public.tasks
where id in (select id from ranked_tasks where rn > 1);

-- ---- 2. Dedupe subjects by (user_id, classroom_course_id) -----------------
with ranked_subjects as (
  select
    id,
    row_number() over (
      partition by user_id, classroom_course_id
      order by created_at asc, id asc
    ) as rn
  from public.subjects
  where classroom_course_id is not null
)
delete from public.subjects
where id in (select id from ranked_subjects where rn > 1);

-- ---- 3. Dedupe exams by (user_id, classroom_coursework_id) ----------------
-- (exams imported from Moodle reuse this column as their UID)
with ranked_exams as (
  select
    id,
    row_number() over (
      partition by user_id, classroom_coursework_id
      order by created_at asc, id asc
    ) as rn
  from public.exams
  where classroom_coursework_id is not null
)
delete from public.exams
where id in (select id from ranked_exams where rn > 1);

-- ---- 4. Dedupe imported tasks that share (title, date, time) --------------
-- Covers the case where the same event was imported multiple times with
-- different external ids (expanded recurrence instances, multiple calendars,
-- old import runs). Scoped to imported tasks only so manually-typed duplicates
-- the user *wants* are untouched.
with ranked_by_title as (
  select
    id,
    row_number() over (
      partition by user_id, coalesce(source, 'manual'), title, date, coalesce(time, '')
      order by
        -- Prefer keeping: done > not done, oldest created
        done desc, created_at asc, id asc
    ) as rn
  from public.tasks
  where source is not null and source <> 'manual'
)
delete from public.tasks
where id in (select id from ranked_by_title where rn > 1);

-- ---- 5. Enforce uniqueness so the bug can't come back ---------------------
-- Idempotent — these may already exist from earlier migrations.
create unique index if not exists tasks_user_cwid_unique
  on public.tasks(user_id, classroom_coursework_id)
  where classroom_coursework_id is not null;

create unique index if not exists subjects_user_classroom_course_unique
  on public.subjects(user_id, classroom_course_id)
  where classroom_course_id is not null;

create unique index if not exists exams_user_cwid_unique
  on public.exams(user_id, classroom_coursework_id)
  where classroom_coursework_id is not null;
