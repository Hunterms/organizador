-- O lugar do bloco. Gollwitzer pede gatilho, hora E lugar: "quando forem 18h
-- de terca, entao abro a lista 3 no escritorio". So com hora, a intencao fica
-- pela metade. Aula ja tem sala; estudo e treino ganham a deles.
alter table public.tasks add column if not exists place text;
alter table public.profiles add column if not exists study_place text;
alter table public.home_routine add column if not exists place text;
