-- ==========================================================================
-- Seed: materias e aulas semanais (proximos 28 dias)
-- IMPORTANTE: substitua YOUR_EMAIL_HERE pelo seu email de login antes de rodar
-- Execute no Supabase SQL Editor — pode rodar varias vezes (idempotente)
-- ==========================================================================

do $$
declare
  uid uuid;
  s_mc536 uuid;
  s_ms211 uuid;
  s_ea513 uuid;
  s_ee400 uuid;
  s_mc404 uuid;
  d date;
  dow int;
  ext_id text;
begin
  select id into uid from auth.users where email = 'YOUR_EMAIL_HERE';
  if uid is null then
    raise exception 'Usuario nao encontrado. Substitua YOUR_EMAIL_HERE pelo seu email.';
  end if;

  -- ---- MC536 ----
  select id into s_mc536 from public.subjects where user_id=uid and code='MC536' limit 1;
  if s_mc536 is null then
    insert into public.subjects (user_id, name, code, class_schedule)
    values (uid, 'MC536 - Banco de Dados', 'MC536', '[
      {"day":1,"time":"08:00","duration":120,"room":"CB08"},
      {"day":3,"time":"08:00","duration":120,"room":"CB08"},
      {"day":5,"time":"08:00","duration":120,"room":"CB09"}
    ]'::jsonb)
    returning id into s_mc536;
  else
    update public.subjects set
      name = 'MC536 - Banco de Dados',
      class_schedule = '[
        {"day":1,"time":"08:00","duration":120,"room":"CB08"},
        {"day":3,"time":"08:00","duration":120,"room":"CB08"},
        {"day":5,"time":"08:00","duration":120,"room":"CB09"}
      ]'::jsonb
    where id = s_mc536;
  end if;

  -- ---- MS211 (sem aulas em tasks) ----
  select id into s_ms211 from public.subjects where user_id=uid and code='MS211' limit 1;
  if s_ms211 is null then
    insert into public.subjects (user_id, name, code, class_schedule)
    values (uid, 'MS211 - Calculo Numerico', 'MS211', '[]'::jsonb)
    returning id into s_ms211;
  end if;

  -- ---- EA513 ----
  select id into s_ea513 from public.subjects where user_id=uid and code='EA513' limit 1;
  if s_ea513 is null then
    insert into public.subjects (user_id, name, code, class_schedule)
    values (uid, 'EA513', 'EA513', '[
      {"day":2,"time":"16:00","duration":120,"room":"PE11"},
      {"day":4,"time":"16:00","duration":120,"room":"PE11"}
    ]'::jsonb)
    returning id into s_ea513;
  else
    update public.subjects set class_schedule = '[
      {"day":2,"time":"16:00","duration":120,"room":"PE11"},
      {"day":4,"time":"16:00","duration":120,"room":"PE11"}
    ]'::jsonb where id = s_ea513;
  end if;

  -- ---- EE400 ----
  select id into s_ee400 from public.subjects where user_id=uid and code='EE400' limit 1;
  if s_ee400 is null then
    insert into public.subjects (user_id, name, code, class_schedule)
    values (uid, 'EE400', 'EE400', '[
      {"day":2,"time":"19:00","duration":120,"room":"FE12"},
      {"day":4,"time":"21:00","duration":120,"room":"FE13"}
    ]'::jsonb)
    returning id into s_ee400;
  else
    update public.subjects set class_schedule = '[
      {"day":2,"time":"19:00","duration":120,"room":"FE12"},
      {"day":4,"time":"21:00","duration":120,"room":"FE13"}
    ]'::jsonb where id = s_ee400;
  end if;

  -- ---- MC404 ----
  select id into s_mc404 from public.subjects where user_id=uid and code='MC404' limit 1;
  if s_mc404 is null then
    insert into public.subjects (user_id, name, code, class_schedule)
    values (uid, 'MC404 - Sistemas Operacionais', 'MC404', '[
      {"day":3,"time":"19:00","duration":120,"room":"CB02"},
      {"day":3,"time":"21:00","duration":120,"room":"LM03"},
      {"day":5,"time":"19:00","duration":120,"room":"CB02"},
      {"day":5,"time":"21:00","duration":120,"room":"LM03"}
    ]'::jsonb)
    returning id into s_mc404;
  else
    update public.subjects set
      name = 'MC404 - Sistemas Operacionais',
      class_schedule = '[
        {"day":3,"time":"19:00","duration":120,"room":"CB02"},
        {"day":3,"time":"21:00","duration":120,"room":"LM03"},
        {"day":5,"time":"19:00","duration":120,"room":"CB02"},
        {"day":5,"time":"21:00","duration":120,"room":"LM03"}
      ]'::jsonb
    where id = s_mc404;
  end if;

  -- ---- Gerar tarefas das aulas pros proximos 28 dias ----
  for d in select generate_series(current_date, current_date + 28, '1 day'::interval)::date loop
    dow := extract(dow from d);

    -- MC536 (Seg=1, Qua=3 → CB08; Sex=5 → CB09)
    if dow in (1, 3) then
      ext_id := 'class-' || s_mc536 || '-' || d || '-08:00';
      if not exists (select 1 from public.tasks where user_id=uid and classroom_coursework_id=ext_id) then
        insert into public.tasks (user_id, title, category, effort, time, date, source, classroom_coursework_id)
        values (uid, 'Aula MC536 (CB08)', 'estudos', '120', '08:00', d, 'class', ext_id);
      end if;
    end if;
    if dow = 5 then
      ext_id := 'class-' || s_mc536 || '-' || d || '-08:00';
      if not exists (select 1 from public.tasks where user_id=uid and classroom_coursework_id=ext_id) then
        insert into public.tasks (user_id, title, category, effort, time, date, source, classroom_coursework_id)
        values (uid, 'Aula MC536 (CB09)', 'estudos', '120', '08:00', d, 'class', ext_id);
      end if;
    end if;

    -- EA513 (Ter=2, Qui=4)
    if dow in (2, 4) then
      ext_id := 'class-' || s_ea513 || '-' || d || '-16:00';
      if not exists (select 1 from public.tasks where user_id=uid and classroom_coursework_id=ext_id) then
        insert into public.tasks (user_id, title, category, effort, time, date, source, classroom_coursework_id)
        values (uid, 'Aula EA513 (PE11)', 'estudos', '120', '16:00', d, 'class', ext_id);
      end if;
    end if;

    -- EE400 (Ter 19h, Qui 21h)
    if dow = 2 then
      ext_id := 'class-' || s_ee400 || '-' || d || '-19:00';
      if not exists (select 1 from public.tasks where user_id=uid and classroom_coursework_id=ext_id) then
        insert into public.tasks (user_id, title, category, effort, time, date, source, classroom_coursework_id)
        values (uid, 'Aula EE400 (FE12)', 'estudos', '120', '19:00', d, 'class', ext_id);
      end if;
    end if;
    if dow = 4 then
      ext_id := 'class-' || s_ee400 || '-' || d || '-21:00';
      if not exists (select 1 from public.tasks where user_id=uid and classroom_coursework_id=ext_id) then
        insert into public.tasks (user_id, title, category, effort, time, date, source, classroom_coursework_id)
        values (uid, 'Aula EE400 (FE13)', 'estudos', '120', '21:00', d, 'class', ext_id);
      end if;
    end if;

    -- MC404 (Qua/Sex → 19h CB02 + 21h LM03)
    if dow in (3, 5) then
      ext_id := 'class-' || s_mc404 || '-' || d || '-19:00';
      if not exists (select 1 from public.tasks where user_id=uid and classroom_coursework_id=ext_id) then
        insert into public.tasks (user_id, title, category, effort, time, date, source, classroom_coursework_id)
        values (uid, 'Aula MC404 (CB02)', 'estudos', '120', '19:00', d, 'class', ext_id);
      end if;
      ext_id := 'class-' || s_mc404 || '-' || d || '-21:00';
      if not exists (select 1 from public.tasks where user_id=uid and classroom_coursework_id=ext_id) then
        insert into public.tasks (user_id, title, category, effort, time, date, source, classroom_coursework_id)
        values (uid, 'Aula MC404 (LM03)', 'estudos', '120', '21:00', d, 'class', ext_id);
      end if;
    end if;
  end loop;

  raise notice 'Concluido: 5 materias e aulas dos proximos 28 dias.';
end $$;
