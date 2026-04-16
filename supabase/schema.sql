-- ==========================================================================
-- Organizador — Schema
-- Execute este arquivo no Supabase SQL Editor (Project → SQL Editor → New Query)
-- Cole tudo e clique "Run"
-- ==========================================================================

-- ------------------------------------------------------------------
-- 1. Profiles (dados do usuario, liga com auth.users)
-- ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  weight numeric default 78,
  bottle_size int default 700,
  water_goal int default 2730,
  pomodoro_settings jsonb default '{"focusDuration":25,"shortBreak":5,"longBreak":15,"sessionsBeforeLong":4}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------------
-- 2. Tasks (checklist diario: estudos, trabalho, pessoal, casa, terreiro)
-- ------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  category text not null check (category in ('estudos','trabalho','terreiro','pessoal','casa')),
  effort text not null default '30' check (effort in ('30','60','120')),
  time text,
  done boolean not null default false,
  date date not null,
  recurring boolean default false,
  position int default 0,
  created_at timestamptz default now()
);

create index if not exists tasks_user_date_idx on public.tasks(user_id, date);

-- ------------------------------------------------------------------
-- 3. Subjects (materias)
-- ------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  code text,
  syllabus text,
  created_at timestamptz default now()
);

create index if not exists subjects_user_idx on public.subjects(user_id);

-- ------------------------------------------------------------------
-- 4. Topics (topicos de cada materia)
-- ------------------------------------------------------------------
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  status text not null default 'not_studied' check (status in ('not_studied','difficulty','mastered')),
  total_study_minutes int default 0,
  last_studied date,
  position int default 0,
  created_at timestamptz default now()
);

create index if not exists topics_subject_idx on public.topics(subject_id);

-- ------------------------------------------------------------------
-- 5. Exams (provas)
-- ------------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  date date not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------
-- 6. Study sessions (log de Pomodoros)
-- ------------------------------------------------------------------
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  subject_id uuid references public.subjects on delete set null,
  topic_name text,
  duration int not null,
  date date not null,
  type text not null default 'focus' check (type in ('focus','break')),
  created_at timestamptz default now()
);

create index if not exists sessions_user_date_idx on public.study_sessions(user_id, date);

-- ------------------------------------------------------------------
-- 7. Water logs (consumo de agua diario)
-- ------------------------------------------------------------------
create table if not exists public.water_logs (
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  bottles int not null default 0,
  primary key (user_id, date)
);

-- ------------------------------------------------------------------
-- 8. Home routine (rotina de casa — dias da semana por comodo)
-- ------------------------------------------------------------------
create table if not exists public.home_routine (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  room_key text not null,
  days int[] not null default array[]::int[],
  unique(user_id, room_key)
);

-- ------------------------------------------------------------------
-- 9. Custom rooms (comodos/tarefas customizadas)
-- ------------------------------------------------------------------
create table if not exists public.custom_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  label text not null,
  icon text not null default 'Sofa',
  color text not null default 'text-blue-400',
  created_at timestamptz default now(),
  unique(user_id, key)
);

-- ------------------------------------------------------------------
-- 10. Kanban (work tasks)
-- ------------------------------------------------------------------
create table if not exists public.kanban_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  project text,
  priority text not null default 'media' check (priority in ('baixa','media','alta')),
  effort text not null default '60' check (effort in ('30','60','120')),
  column_name text not null default 'todo' check (column_name in ('todo','doing','done')),
  position int default 0,
  created_at timestamptz default now()
);

create index if not exists kanban_user_idx on public.kanban_cards(user_id, column_name);

-- ==========================================================================
-- ROW LEVEL SECURITY
-- Cada usuario so ve seus proprios dados
-- ==========================================================================

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.exams enable row level security;
alter table public.study_sessions enable row level security;
alter table public.water_logs enable row level security;
alter table public.home_routine enable row level security;
alter table public.custom_rooms enable row level security;
alter table public.kanban_cards enable row level security;

-- Helper: cria policies padrao para tabelas com user_id
do $$
declare tbl text;
begin
  for tbl in select unnest(array[
    'tasks','subjects','topics','exams','study_sessions',
    'water_logs','home_routine','custom_rooms','kanban_cards'
  ])
  loop
    execute format('drop policy if exists "own_select" on public.%I;', tbl);
    execute format('create policy "own_select" on public.%I for select using (auth.uid() = user_id);', tbl);
    execute format('drop policy if exists "own_insert" on public.%I;', tbl);
    execute format('create policy "own_insert" on public.%I for insert with check (auth.uid() = user_id);', tbl);
    execute format('drop policy if exists "own_update" on public.%I;', tbl);
    execute format('create policy "own_update" on public.%I for update using (auth.uid() = user_id);', tbl);
    execute format('drop policy if exists "own_delete" on public.%I;', tbl);
    execute format('create policy "own_delete" on public.%I for delete using (auth.uid() = user_id);', tbl);
  end loop;
end $$;

-- Profiles policies (linked via id not user_id)
drop policy if exists "profile_select" on public.profiles;
create policy "profile_select" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profile_insert" on public.profiles;
create policy "profile_insert" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profile_update" on public.profiles;
create policy "profile_update" on public.profiles for update using (auth.uid() = id);

-- ==========================================================================
-- TRIGGER: criar profile automatico quando usuario loga pela primeira vez
-- ==========================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;

  -- Seed default home routine
  insert into public.home_routine (user_id, room_key, days) values
    (new.id, 'areia_gato',     array[0,1,2,3,4,5,6]),
    (new.id, 'comida_gato',    array[0,1,2,3,4,5,6]),
    (new.id, 'sala',           array[1,4]),
    (new.id, 'quarto',         array[3]),
    (new.id, 'escritorio',     array[5]),
    (new.id, 'banheiro',       array[6]),
    (new.id, 'lavanderia',     array[0]),
    (new.id, 'lixo_organico',  array[1,4]),
    (new.id, 'lixo_reciclavel',array[2,5])
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================================================
-- STORAGE BUCKET: PDFs de ementas
-- ==========================================================================
insert into storage.buckets (id, name, public)
values ('syllabi', 'syllabi', false)
on conflict do nothing;

-- RLS para storage
drop policy if exists "own_syllabi_select" on storage.objects;
create policy "own_syllabi_select" on storage.objects for select
  using (bucket_id = 'syllabi' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "own_syllabi_insert" on storage.objects;
create policy "own_syllabi_insert" on storage.objects for insert
  with check (bucket_id = 'syllabi' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "own_syllabi_delete" on storage.objects;
create policy "own_syllabi_delete" on storage.objects for delete
  using (bucket_id = 'syllabi' and auth.uid()::text = (storage.foldername(name))[1]);
