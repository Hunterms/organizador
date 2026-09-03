-- ==========================================================================
-- Seed: coordenacao. O que hoje mora na cabeca do Hunter.
--
-- Quatro frentes: midias do terreiro, adm da gira, time de design com os 6
-- projetos, e os cuidados com os guias.
--
-- REGRA DE ESCOPO, decidida em 02/09/2026: aqui entram SO AS TAREFAS DELE.
-- O app e single-user (RLS: auth.uid() = user_id) e ninguem do terreiro vai
-- logar, entao "tarefa da Maria" seria anotacao sobre a Maria que so ele ve:
-- nao notifica ela, nao pode ser fechada por ela, e vira segunda copia da
-- realidade divergindo do grupo onde a coordenacao acontece de fato.
--
-- O que ENTRA e a ESCALA (dado estavel, muda raro) e o PORTAO dele. "Maria
-- posta terca" nao e trabalho dele; "validar o post da Maria" e. Registrando o
-- portao, quem posta vem de graca no titulo. Um registro, nao dois.
--
-- E o conteudo do post mora no repo candieiro-conteudo, nao aqui. Este arquivo
-- guarda a escala e o portao.
--
-- COMO PREENCHER: troque o que esta em MAIUSCULA. Idempotente, pode rodar de
-- novo depois de editar. Rode depois de espiritual-category-migration.sql e
-- eventos-migration.sql.
--
-- days: 0=domingo 1=seg 2=ter 3=qua 4=qui 5=sex 6=sabado
-- interval_weeks: 1 toda semana, 2 quinzenal, 4 mensal
-- week_offset: qual semana do ciclo (0 ou 1 pra quinzenal). A contagem sai da
--   EPOCH_SEGUNDA = 2026-08-31 em src/lib/rotina.js.
-- ==========================================================================
do $$
declare
  uid uuid;
  r record;
begin
  if (select count(*) from auth.users) = 1 then
    select id into uid from auth.users limit 1;
  else
    select id into uid from auth.users where email = 'TROQUE_PELO_SEU_EMAIL';
  end if;
  if uid is null then
    raise exception 'Ha % contas em auth.users. Troque TROQUE_PELO_SEU_EMAIL pelo seu email de login.',
      (select count(*) from auth.users);
  end if;

  -- ---- 1. Rotinas de coordenacao e devocao -------------------------------
  -- Cada linha vira uma tarefa recorrente no dia certo. O motor e o mesmo da
  -- rotina de casa (home_routine + custom_rooms + rotina.js), que ja e generico:
  -- o comentario em store.js:469 diz "a rotina deixou de ser so casa".
  for r in
    select * from (values
      -- ESCALA DE MIDIA: um portao SEU por pessoa da escala. O titulo carrega o
      -- nome de quem posta, entao a escala fica registrada sem tabela de gente.
      -- Ponha o portao um dia ANTES do dia de post, pra sobrar tempo de corrigir.
      ('midia-PESSOA1', 'Validar post da PESSOA1',      'terreiro',   '{1}',   1, 0, '20:00', '10', 'Monitor',  'text-green-400'),
      ('midia-PESSOA2', 'Validar post da PESSOA2',      'terreiro',   '{3}',   1, 0, '20:00', '10', 'Monitor',  'text-green-400'),
      ('midia-PESSOA3', 'Validar post da PESSOA3',      'terreiro',   '{5}',   1, 0, '20:00', '10', 'Monitor',  'text-green-400'),
      -- Voce tambem cria arte pra quem nao usa Canva/PS. Isso e trabalho seu com
      -- hora, nao portao: bloco proprio, esforco de verdade.
      ('midia-arte',    'Fazer a arte de quem nao monta','terreiro',  '{0}',   1, 0, '15:00', '60', 'Scissors', 'text-green-400'),
      ('midia-escala',  'Fechar a escala da semana',     'terreiro',   '{0}',   1, 0, '19:00', '30', 'Monitor',  'text-green-400'),

      -- TIME DE DESIGN E PROJETOS. Voce disse que acompanhar CiX e DPS e (a)
      -- reuniao com hora fixa e (b) desbloquear quando alguem trava. A (a) e
      -- isto. A (b) nao tem cadencia possivel: vira card no kanban quando
      -- acontece, e nao rotina que cobra sem motivo.
      ('ritual-cix',    'Ritual CiX',                    'trabalho',   '{4}',   1, 0, 'HH:MM', '60', 'Monitor',  'text-blue-400'),
      ('ritual-dps',    'Ritual DPS',                    'trabalho',   '{4}',   1, 0, 'HH:MM', '60', 'Monitor',  'text-blue-400'),
      ('time-design',   'Time de design: 1-1 e fila',    'trabalho',   '{1}',   1, 0, 'HH:MM', '60', 'Activity', 'text-blue-400'),

      -- CUIDADOS COM OS GUIAS. Categoria propria porque e devocao pessoal, nao
      -- organizacao da comunidade: voce listou as duas como coisas separadas.
      ('guias-agua',    'Trocar a agua dos guias',       'espiritual', '{1}',   1, 0, '07:00', '5',  'Droplets', 'text-fuchsia-400'),
      ('guias-vela',    'Acender vela',                  'espiritual', '{5}',   1, 0, '18:00', '5',  'Sparkles', 'text-fuchsia-400'),
      ('guias-firmeza', 'Firmeza: TROQUE PELO QUE E',    'espiritual', '{1}',   2, 0, '07:00', '30', 'Sparkles', 'text-fuchsia-400'),
      ('guias-banho',   'Banho de ervas',                'espiritual', '{6}',   2, 1, '08:00', '30', 'Sprout',   'text-fuchsia-400'),
      ('guias-limpeza', 'Limpar o assentamento',         'espiritual', '{0}',   4, 0, '09:00', '60', 'Sparkles', 'text-fuchsia-400')
    ) as t(key, label, categoria, days, intervalo, offset_semana, hora, esforco, icone, cor)
  loop
    -- O label e o titulo da tarefa gerada (roomLabelFor -> custom_rooms.label).
    insert into public.custom_rooms (user_id, key, label, icon, color)
      values (uid, r.key, r.label, r.icone, r.cor)
      on conflict (user_id, key) do update set
        label = excluded.label, icon = excluded.icon, color = excluded.color;

    insert into public.home_routine
      (user_id, room_key, days, category, time, effort, interval_weeks, week_offset)
      values (uid, r.key, r.days::int[], r.categoria, nullif(r.hora, 'HH:MM'),
              r.esforco, r.intervalo, r.offset_semana)
      on conflict (user_id, room_key) do update set
        days = excluded.days, category = excluded.category, time = excluded.time,
        effort = excluded.effort, interval_weeks = excluded.interval_weeks,
        week_offset = excluded.week_offset;
  end loop;

  -- ---- 2. Gira como evento com preparo -----------------------------------
  -- Recorrencia responde "cai hoje?". Evento responde "o que a data de sabado
  -- exige de mim hoje?". O preparo se espalha pra tras a partir da data.
  -- Ajuste as datas (ou troque por recorrencia) e o checklist.
  insert into public.eventos (user_id, nome, categoria, place, datas, recorrencia, checklist)
    values (
      uid, 'Gira', 'terreiro', 'Barao Geraldo',
      -- Datas cravadas. Se a gira for quinzenal fixa, apague o array e use a
      -- recorrencia da linha seguinte em vez dele.
      '["2026-09-19","2026-10-03","2026-10-17"]'::jsonb,
      null,  -- ou: '{"days":[6],"interval_weeks":2,"week_offset":0}'::jsonb
      '[
        {"titulo":"Conferir material e o que falta","diasAntes":5,"effort":"30"},
        {"titulo":"Comprar o que faltou","diasAntes":3,"effort":"60"},
        {"titulo":"Confirmar quem vem e quem falta","diasAntes":2,"effort":"30"},
        {"titulo":"Passar a escala de funcao pro grupo","diasAntes":2,"effort":"30"},
        {"titulo":"Arrumar o salao","diasAntes":1,"effort":"120"},
        {"titulo":"Gira","diasAntes":0,"effort":"120"}
      ]'::jsonb
    )
    on conflict (user_id, nome) do update set
      categoria = excluded.categoria, place = excluded.place,
      datas = excluded.datas, recorrencia = excluded.recorrencia,
      checklist = excluded.checklist, ativo = true;

  raise notice 'Coordenacao semeada. Edite o que esta em MAIUSCULA e rode de novo.';
end $$;

-- Conferir o que entrou:
--   select room_key, days, category, time, effort, interval_weeks, week_offset
--     from public.home_routine order by category, room_key;
--   select nome, datas, jsonb_array_length(checklist) as itens from public.eventos;
