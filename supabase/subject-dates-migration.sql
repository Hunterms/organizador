-- Cada materia tem seu proprio recorte do semestre. MC621 comecou 21/08 e
-- termina 20/11; EE400 cancelou 5 datas. Sem isso o denominador dos 75% conta
-- aula que nunca existiu, e o app diz que voce tem mais folga do que tem.
alter table public.subjects add column if not exists start_date date;   -- null = usa o inicio do semestre
alter table public.subjects add column if not exists end_date date;     -- null = usa o fim do semestre
alter table public.subjects add column if not exists skip_dates jsonb default '[]'::jsonb;  -- ['2026-09-07', ...]
