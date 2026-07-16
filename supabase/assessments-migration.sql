-- Provas e atividades (reusa a tabela exams). type separa as duas listas;
-- status/grade permitem acompanhar e calcular a media.
alter table public.exams add column if not exists type text not null default 'prova'
  check (type in ('prova','atividade'));
alter table public.exams add column if not exists status text not null default 'pendente'
  check (status in ('pendente','feita'));
alter table public.exams add column if not exists grade numeric;

-- Formula da media por materia, avaliada no cliente (ex: (P1+P2+media(atividades))/3).
alter table public.subjects add column if not exists grade_formula text;
