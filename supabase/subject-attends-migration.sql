-- Materia que o Hunter nao frequenta. Quando false:
--   - nao conta falta (nem alerta de 75%)
--   - nao vira tarefa de aula nem lembrete de 1h antes
--   - o horario dela deixa de bloquear o planejador: vira tempo livre de estudo
-- EE400 e MC621 entram aqui. EA513 nao precisa: ela nem tem grade.
alter table public.subjects add column if not exists attends boolean not null default true;
