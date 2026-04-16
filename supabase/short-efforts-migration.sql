-- ==========================================================================
-- Migration: Add 5 and 10 minute effort options for quick tasks
-- (marcar consulta, mandar email, etc. — things where "30min" is overkill)
-- Run this once in the Supabase SQL Editor.
-- ==========================================================================

-- tasks
alter table public.tasks drop constraint if exists tasks_effort_check;
alter table public.tasks add constraint tasks_effort_check
  check (effort in ('5','10','30','60','120'));

-- kanban_cards (work board)
alter table public.kanban_cards drop constraint if exists kanban_cards_effort_check;
alter table public.kanban_cards add constraint kanban_cards_effort_check
  check (effort in ('5','10','30','60','120'));
