-- home_routine ja e "tarefa semanal por dia da semana", com materializacao no
-- app e no servidor. Faltavam so os campos pra ela servir alem da casa:
-- treino tem horario e dura mais que um comodo.
alter table public.home_routine add column if not exists category text not null default 'casa'
  check (category in ('estudos','trabalho','terreiro','pessoal','casa','aula'));
alter table public.home_routine add column if not exists time text;
alter table public.home_routine add column if not exists effort text not null default '30'
  check (effort in ('5','10','30','60','120'));
