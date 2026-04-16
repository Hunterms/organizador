-- ==========================================================================
-- Migration: Google Calendar integration
-- Execute este arquivo no Supabase SQL Editor
-- ==========================================================================

-- Adiciona campos pra integracao Google Calendar na profile
alter table public.profiles
  add column if not exists google_calendar_id text,
  add column if not exists google_connected_at timestamptz,
  add column if not exists google_last_synced_at timestamptz;

-- Adiciona google_event_id em tasks e exams pra atualizar/deletar depois
alter table public.tasks
  add column if not exists google_event_id text;

alter table public.exams
  add column if not exists google_event_id text;
