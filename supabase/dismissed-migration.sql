-- ==========================================================================
-- Migration: Soft-delete flag for imported tasks and subjects
-- Run this once in the Supabase SQL Editor.
-- ==========================================================================
-- Why:
--   Items imported from Classroom / Moodle / Work Calendar should not be
--   hard-deleted when the user removes them from the app — otherwise the next
--   sync re-creates them. We keep them in the DB with dismissed=true; the UI
--   filters them out and the import code uses them for dedup (never re-create).
--
--   - tasks imported from Classroom/Moodle/Work Calendar → dismiss on delete
--   - subjects imported from Classroom (old semesters) → dismiss on delete
--
--   Manual items keep their existing hard-delete behavior.
-- ==========================================================================

alter table public.tasks
  add column if not exists dismissed boolean default false;

alter table public.subjects
  add column if not exists dismissed boolean default false;

-- Backfill any existing nulls
update public.tasks    set dismissed = false where dismissed is null;
update public.subjects set dismissed = false where dismissed is null;

-- Partial indexes: fast lookup of active items (the 99% case)
create index if not exists tasks_user_active_idx
  on public.tasks(user_id, date) where dismissed = false;

create index if not exists subjects_user_active_idx
  on public.subjects(user_id) where dismissed = false;
