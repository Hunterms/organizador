-- ==========================================================================
-- Migration: categoria 'espiritual'
--
-- POR QUE UMA SO, E NAO UMA TAXONOMIA DE COORDENACAO.
-- O Hunter coordena quatro frentes (midias do terreiro, adm da gira, time de
-- design com 6 projetos, e a propria vida espiritual). Tres delas JA tem
-- categoria: coordenar midia e adm da gira sao 'terreiro'; time e projeto sao
-- 'trabalho'. So os cuidados com os guias nao tinham casa: e devocao pessoal,
-- nao organizacao da comunidade, e ele listou as duas como coisas separadas.
--
-- E POR QUE NAO PRECISOU DE TABELA NOVA.
-- `home_routine` + `custom_rooms` ja e um motor de recorrencia GENERICO com
-- nome de casa: ensureTodayRoutineTasks (store.js:467) le days,
-- interval_weeks, week_offset, category, time, effort e place, e o comentario
-- dele mesmo diz que "a rotina deixou de ser so casa (pilates e academia
-- entram por aqui)". Entao:
--   - obrigacao com os guias    = custom_room + home_routine, category espiritual
--   - "validar post da Maria"   = custom_room + home_routine, category terreiro
--   - ritual semanal do CiX/DPS = custom_room + home_routine, category trabalho
-- Sao linhas de dado, nao codigo. O que faltava era o valor da categoria.
-- ==========================================================================

alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check
  check (category in ('estudos','trabalho','terreiro','pessoal','casa','aula','espiritual'));

-- home_routine.category segue a mesma lista (a coluna entrou numa migracao
-- posterior ao schema.sql; o drop e idempotente se ela nao tiver constraint).
alter table public.home_routine drop constraint if exists home_routine_category_check;
alter table public.home_routine add constraint home_routine_category_check
  check (category is null or category in ('estudos','trabalho','terreiro','pessoal','casa','aula','espiritual'));
