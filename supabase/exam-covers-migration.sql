-- Qual faixa de topicos cada avaliacao cobre, por position. Sem isso o
-- planejador pode gastar a semana antes da P1 de EE400 estudando Series, que
-- so cai na P3 — e a auditoria de cobertura mede contra o denominador errado.
-- null nos dois = a prova cobre tudo.
alter table public.exams add column if not exists covers_from int;
alter table public.exams add column if not exists covers_to int;
