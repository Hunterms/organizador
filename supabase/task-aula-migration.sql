-- A tarefa de aula aponta pra materia. O subject_id e o que permite ao push
-- perguntar "voce foi na aula de EE400?" e gravar a presenca na materia certa.
-- (A categoria 'aula' ja existe, veio de aula-category-migration.sql.)
alter table public.tasks add column if not exists subject_id uuid references public.subjects(id) on delete cascade;
create index if not exists tasks_subject_idx on public.tasks(subject_id) where subject_id is not null;
