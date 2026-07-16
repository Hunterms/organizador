-- Horario de sono do user, alimenta os push (digest na hora de acordar,
-- agua entre acordar e dormir, silencio durante o sono).
alter table public.profiles add column if not exists wake_hour int not null default 7;
alter table public.profiles add column if not exists sleep_hour int not null default 22;
