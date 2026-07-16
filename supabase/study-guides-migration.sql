-- Guias de estudo por tarefa. Um guia (HTML) pode ser referenciado por varias
-- tarefas (ex: teoria e atividade do mesmo topico).
create table if not exists public.study_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  html text not null,
  created_at timestamptz not null default now()
);
create index if not exists study_guides_user_idx on public.study_guides(user_id);

alter table public.study_guides enable row level security;
drop policy if exists "own guides" on public.study_guides;
create policy "own guides" on public.study_guides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.tasks add column if not exists guide_id uuid references public.study_guides(id) on delete set null;
