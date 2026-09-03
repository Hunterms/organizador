-- ==========================================================================
-- Migration: eventos com preparo
--
-- O unico conceito que a coordenacao do Hunter pediu e a casa nao tinha.
-- Recorrencia (home_routine + rotina.js) responde "cai hoje?". Isto responde
-- "o que a data de sabado exige de mim HOJE?", que e outra pergunta: o preparo
-- da gira se espalha pra tras a partir dela (material 3 dias antes, confirmar
-- gente 2 dias antes, arrumar o salao 1 dia antes).
--
-- checklist e recorrencia sao JSONB pelo mesmo motivo que class_schedule e
-- skip_dates sao: a forma varia por evento e nao vale uma tabela filha pra
-- guardar tres campos. Ver src/lib/eventos.js pro contrato.
-- ==========================================================================

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  nome text not null,
  categoria text not null default 'terreiro'
    check (categoria in ('estudos','trabalho','terreiro','pessoal','casa','aula','espiritual')),
  place text default '',
  -- datas cravadas: ["2026-09-05","2026-09-19"]
  datas jsonb not null default '[]'::jsonb,
  -- ou regra, no mesmo formato do home_routine: {"days":[6],"interval_weeks":2,"week_offset":0}
  recorrencia jsonb,
  -- [{"titulo":"Comprar material","diasAntes":3,"effort":"60","time":"10:00"}]
  checklist jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz default now(),
  -- Permite o seed ser idempotente (on conflict do update). Um evento com o
  -- mesmo nome duas vezes seria erro de digitacao, nao intencao.
  unique(user_id, nome)
);

create index if not exists eventos_user_idx on public.eventos(user_id) where ativo;

alter table public.eventos enable row level security;

drop policy if exists "own_select" on public.eventos;
create policy "own_select" on public.eventos for select using (auth.uid() = user_id);
drop policy if exists "own_insert" on public.eventos;
create policy "own_insert" on public.eventos for insert with check (auth.uid() = user_id);
drop policy if exists "own_update" on public.eventos;
create policy "own_update" on public.eventos for update using (auth.uid() = user_id);
drop policy if exists "own_delete" on public.eventos;
create policy "own_delete" on public.eventos for delete using (auth.uid() = user_id);

-- Amarra a tarefa gerada no evento que a gerou, pra dedupe nao depender de
-- titulo (o titulo carrega "em 3d", que muda todo dia).
alter table public.tasks add column if not exists evento_id uuid references public.eventos(id) on delete cascade;
alter table public.tasks add column if not exists evento_data date;

create index if not exists tasks_evento_idx on public.tasks(evento_id, evento_data) where evento_id is not null;
