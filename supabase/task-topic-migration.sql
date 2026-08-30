-- Amarra a tarefa de estudo ao topico que ela cobre. Sem isso o topico so
-- existe como texto no titulo, o app nunca sabe o que foi estudado, e o plano
-- da semana seguinte sorteia os mesmos topicos de novo.
alter table public.tasks add column if not exists topic_id uuid references public.topics(id) on delete set null;
