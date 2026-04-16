-- ==========================================================================
-- Migration: Evidence-backed study methods
-- Adds retrieval practice tracking, spaced repetition, Feynman notes.
-- Run this once in the Supabase SQL Editor.
-- ==========================================================================

-- ---- 1. Extend topics with confidence + spaced-repetition + reflection ----
alter table public.topics
  add column if not exists confidence int default 0 check (confidence >= 0 and confidence <= 5),
  add column if not exists last_retrieval_at timestamptz,
  add column if not exists next_review_at date,
  add column if not exists retrieval_count int default 0,
  add column if not exists feynman_note text,
  add column if not exists why_difficult text;

-- Partial index: fast lookup of "due for review today"
create index if not exists topics_next_review_idx
  on public.topics(user_id, next_review_at)
  where next_review_at is not null;

-- ---- 2. Retrieval attempts: one row per practice test ---------------------
create table if not exists public.retrieval_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  topic_id uuid not null references public.topics on delete cascade,
  subject_id uuid references public.subjects on delete set null,
  score int not null check (score >= 1 and score <= 5),
  duration_sec int default 0,
  response_text text,
  created_at timestamptz default now()
);

create index if not exists retrieval_user_topic_idx
  on public.retrieval_attempts(user_id, topic_id, created_at desc);

-- ---- 3. RLS ---------------------------------------------------------------
alter table public.retrieval_attempts enable row level security;

drop policy if exists "own_select" on public.retrieval_attempts;
create policy "own_select" on public.retrieval_attempts
  for select using (auth.uid() = user_id);

drop policy if exists "own_insert" on public.retrieval_attempts;
create policy "own_insert" on public.retrieval_attempts
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_update" on public.retrieval_attempts;
create policy "own_update" on public.retrieval_attempts
  for update using (auth.uid() = user_id);

drop policy if exists "own_delete" on public.retrieval_attempts;
create policy "own_delete" on public.retrieval_attempts
  for delete using (auth.uid() = user_id);
