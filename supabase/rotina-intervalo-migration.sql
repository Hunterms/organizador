-- Rotina quinzenal e mensal. Ate aqui home_routine so sabia dia da semana, e
-- "trocar a lamina" ou "limpar a geladeira" nao cabem em toda semana.
--   interval_weeks 1 semanal · 2 quinzenal · 4 mensal · 8 bimestral · 12 trimestral
--   (12 existe porque a ADA recomenda trocar a escova a cada 3 a 4 meses)
--   week_offset    qual semana do ciclo, pra nao empilhar tudo na mesma
-- A semana e contada a partir de uma segunda fixa (EPOCH em lib/rotina.js),
-- entao o resultado e o mesmo no app e no servidor, sem coluna de ancora.
alter table public.home_routine add column if not exists interval_weeks int not null default 1
  check (interval_weeks in (1,2,4,8,12));
alter table public.home_routine add column if not exists week_offset int not null default 0
  check (week_offset >= 0 and week_offset < 12);
