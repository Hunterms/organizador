-- Compromisso fixo que nao e aula: terreiro no sabado 16-23, por exemplo.
-- Mesmo formato de subjects.class_schedule ([{day,time,duration,room}]), porque
-- o planejador ja sabe desviar desse formato — nao precisa de motor novo.
alter table public.profiles add column if not exists busy_windows jsonb not null default '[]'::jsonb;
