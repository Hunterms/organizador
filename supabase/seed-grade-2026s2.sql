-- ==========================================================================
-- Seed: 2o semestre de 2026 — grade, recortes, feriados e avaliacoes
--
-- Fontes: print da grade + PDDs (MC621, MC426/MC656, MC404, EE400, EA513,
-- MS211) + calendario DAC 2026 (2o periodo letivo: 10/08 a 05/12).
--
-- day: 0=Dom 1=Seg 2=Ter 3=Qua 4=Qui 5=Sex 6=Sab · duration em minutos
-- skip_dates: dia sem aula. Sai do denominador dos 75%, porque aula que nao
--   aconteceu nao pode contar como falta possivel.
--
-- Nao precisa editar nada se voce so tem uma conta no projeto Supabase.
-- Idempotente: pode rodar quantas vezes quiser.
-- Requer: semester-migration.sql e subject-dates-migration.sql ja aplicados.
-- ==========================================================================

do $$
declare
  uid uuid;
  r record;
  sid uuid;
  e record;
  -- Datas sem aula que valem pra quem tem aula naquele dia da semana.
  -- 07/09 Independencia (seg) · 12/10 Aparecida (seg) · 28/10 Servidor (qua)
  -- 02/11 Finados (seg). 12/08 e cancelamento proprio de EE400.
  seg_qua jsonb := '["2026-09-07","2026-10-12","2026-10-28","2026-11-02"]'::jsonb;
begin
  -- Conta unica no projeto: acha sozinho, nao precisa editar nada.
  -- Mais de uma conta: para e avisa, em vez de semear na errada.
  if (select count(*) from auth.users) = 1 then
    select id into uid from auth.users limit 1;
  else
    select id into uid from auth.users where email = 'TROQUE_PELO_SEU_EMAIL';
  end if;
  if uid is null then
    raise exception 'Ha % contas em auth.users. Troque TROQUE_PELO_SEU_EMAIL pelo seu email de login.',
      (select count(*) from auth.users);
  end if;

  -- Semestre oficial da DAC
  update public.profiles
     set semester_start = '2026-08-10', semester_end = '2026-12-05'
   where id = uid;

  -- ---- Materias -----------------------------------------------------------
  for r in
    select * from (values
      -- code, nome, grade, inicio, fim, sem aula, formula da media
      ('EE400', 'EE400 A - Metodos da Engenharia Eletrica',
       '[{"day":1,"time":"08:00","duration":120,"room":"PE12"},
         {"day":3,"time":"08:00","duration":120,"room":"PE12"}]'::jsonb,
       null::date, null::date,
       '["2026-08-12","2026-09-07","2026-10-12","2026-10-28","2026-11-02"]'::jsonb,
       '(P1+P2+P3)/3'),

      ('MC426', 'MC426 A - Engenharia de Software',
       '[{"day":2,"time":"08:00","duration":120,"room":"CB07"},
         {"day":4,"time":"08:00","duration":120,"room":"CB07"}]'::jsonb,
       null::date, null::date, '[]'::jsonb,
       '0.8*(A1+A2+A3+A4+A5)+0.2*PF'),

      ('MC404', 'MC404 B - Organizacao Basica de Computadores',
       '[{"day":1,"time":"14:00","duration":120,"room":"CB03"},
         {"day":3,"time":"16:00","duration":120,"room":"CC00"}]'::jsonb,
       null::date, null::date, seg_qua,
       '0.6*(P1+P2)/2+0.4*MA'),

      -- MC621: SECOMP em 14/08, primeira aula 21/08, ultima 20/11. Sem exame.
      ('MC621', 'MC621 A - Desafios de Programacao II',
       '[{"day":5,"time":"14:00","duration":240,"room":"Lab CC03 (IC3)"}]'::jsonb,
       '2026-08-21'::date, '2026-11-20'::date, '[]'::jsonb,
       'min(X/12, 10)'),

      ('MS211', 'MS211 Y - Calculo Numerico',
       '[{"day":2,"time":"19:00","duration":120,"room":"PB13"},
         {"day":4,"time":"21:00","duration":120,"room":"CB10"}]'::jsonb,
       null::date, null::date, '[]'::jsonb,
       '(P1+P2+(A1+A2+A3+A4)/4)/3'),

      -- MC919/MO446: PDD diz 2a 21-22:40 e 4a 19-20:40. Sao 2 horas-aula de 50min
      -- cada, entao duration 120 mantem a conta em horas-aula (que e como a
      -- Unicamp conta falta), nao em minutos de relogio.
      ('MC919', 'MC919 A - Visao Computacional',
       '[{"day":1,"time":"21:00","duration":120,"room":"PB14"},
         {"day":3,"time":"19:00","duration":120,"room":"PB14"}]'::jsonb,
       null::date, null::date, seg_qua, '(T1+T2+T3)/3'),

      -- EA513 e Turma Especial II: o PDD diz que presenca nao e exigida, e ela
      -- nao esta na grade. Sem class_schedule, ela nunca entra na conta de faltas.
      ('EA513', 'EA513 - Circuitos Eletricos (Especial II, sem presenca)',
       '[]'::jsonb, null::date, null::date, '[]'::jsonb, '0.4*P1+0.6*P2')
    ) as t(code, nome, sched, ini, fim, skips, formula)
  loop
    select id into sid from public.subjects where user_id = uid and code = r.code;
    if sid is null then
      insert into public.subjects (user_id, name, code, class_schedule, start_date, end_date, skip_dates, grade_formula)
        values (uid, r.nome, r.code, r.sched, r.ini, r.fim, r.skips, r.formula)
        returning id into sid;
    else
      update public.subjects set name = r.nome, class_schedule = r.sched,
             start_date = r.ini, end_date = r.fim, skip_dates = r.skips,
             grade_formula = coalesce(r.formula, grade_formula)
        where id = sid;
    end if;
  end loop;

  -- ---- Provas e atividades ------------------------------------------------
  for e in
    select * from (values
      ('EE400', 'Prova 1',        '2026-09-09'::date, 'prova'),
      ('EE400', 'Prova 2',        '2026-10-21'::date, 'prova'),
      ('EE400', 'Prova 3',        '2026-12-02'::date, 'prova'),
      ('EE400', 'Exame final',    '2026-12-14'::date, 'prova'),

      ('MC426', 'A1',             '2026-09-01'::date, 'atividade'),
      ('MC426', 'A2',             '2026-09-17'::date, 'atividade'),
      ('MC426', 'A3',             '2026-10-01'::date, 'atividade'),
      ('MC426', 'A4',             '2026-10-22'::date, 'atividade'),
      ('MC426', 'A5',             '2026-11-17'::date, 'atividade'),
      ('MC426', 'Projeto Final',  '2026-11-24'::date, 'atividade'),
      ('MC426', 'Exame final',    '2026-12-10'::date, 'prova'),

      ('MC404', 'Prova 1',        '2026-10-19'::date, 'prova'),
      ('MC404', 'Prova 2',        '2026-11-30'::date, 'prova'),
      ('MC404', 'Exame final',    '2026-12-10'::date, 'prova'),

      ('MC621', 'Ultimo envio de solucoes/relatorios', '2026-11-16'::date, 'atividade'),

      -- MC919 nao publica datas: o PDD diz que cada trabalho tem ~30 dias e a
      -- apresentacao cai na 1a ou 2a semana do mes seguinte. As datas abaixo sao
      -- ESTIMATIVA por essa regra, nao data divulgada. Corrija no app quando sair.
      ('MC919', 'Trabalho 1 (data a confirmar)', '2026-10-05'::date, 'atividade'),
      ('MC919', 'Trabalho 2 (data a confirmar)', '2026-11-09'::date, 'atividade'),
      ('MC919', 'Trabalho 3 (data a confirmar)', '2026-12-01'::date, 'atividade'),

      ('MS211', 'Prova 1',        '2026-10-06'::date, 'prova'),
      ('MS211', 'Prova 2',        '2026-12-01'::date, 'prova'),
      ('MS211', 'Exame',          '2026-12-15'::date, 'prova'),

      ('EA513', 'Prova 1',        '2026-09-17'::date, 'prova'),
      ('EA513', 'Prova 2',        '2026-12-03'::date, 'prova')
    ) as t(code, nome, data, tipo)
  loop
    select id into sid from public.subjects where user_id = uid and code = e.code;
    if sid is null then continue; end if;
    if not exists (select 1 from public.exams where user_id = uid and subject_id = sid and name = e.nome) then
      insert into public.exams (user_id, subject_id, name, date, type)
        values (uid, sid, e.nome, e.data, e.tipo);
    else
      update public.exams set date = e.data, type = e.tipo
        where user_id = uid and subject_id = sid and name = e.nome;
    end if;
  end loop;
end $$;
