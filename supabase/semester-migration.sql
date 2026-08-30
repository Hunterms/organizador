-- Inicio e fim do semestre. Sem essas datas o calculo dos 75% cai numa
-- estimativa de 16 semanas e nao sabe quantas aulas ja passaram — logo nao
-- consegue dizer quantas faltas voce ainda tem.
alter table public.profiles add column if not exists semester_start date;
alter table public.profiles add column if not exists semester_end date;
