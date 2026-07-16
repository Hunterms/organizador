-- Presenca/faltas por aula. Reusa subjects.class_schedule (jsonb) pro horario.
-- Uma linha por (materia, dia) marcada como presente ou falta.
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present','absent')),
  created_at timestamptz not null default now(),
  unique (user_id, subject_id, date)
);
create index if not exists attendance_user_idx on public.attendance(user_id);

alter table public.attendance enable row level security;

drop policy if exists "own attendance" on public.attendance;
create policy "own attendance" on public.attendance
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- garante a coluna de horario (ja existe, idempotente)
alter table public.subjects add column if not exists class_schedule jsonb default '[]'::jsonb;
