-- O horario da "aula" e, na verdade, janela de entrega. MC621: exercicio
-- entregue nas primeiras 4h vale 2 pontos, depois vale 1. Estar na janela e a
-- diferenca entre precisar de 30 ou de 60 problemas no semestre.
-- So faz efeito junto com attends=false: nao e aula, e trabalho.
alter table public.subjects add column if not exists work_slot boolean not null default false;

-- Manhas liberadas pra estudo (0=dom .. 6=sab). O bloco da manha substitui um
-- da noite naquele dia, entao o orcamento semanal nao muda.
alter table public.profiles add column if not exists morning_days int[] not null default '{}';
