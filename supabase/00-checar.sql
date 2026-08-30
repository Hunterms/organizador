-- ==========================================================================
-- Rode ISTO PRIMEIRO. Nao muda nada: so diz o que ja existe no seu banco.
-- Cada linha responde OK ou FALTA, e quando falta diz qual arquivo rodar.
-- ==========================================================================
select 'exams.type / status / grade'                          as peca,
       case when exists (select 1 from information_schema.columns
          where table_name='exams' and column_name='type')
       then 'OK' else 'FALTA -> assessments-migration.sql' end as situacao
union all select 'subjects.grade_formula',
       case when exists (select 1 from information_schema.columns
          where table_name='subjects' and column_name='grade_formula')
       then 'OK' else 'FALTA -> assessments-migration.sql' end
union all select 'subjects.class_schedule',
       case when exists (select 1 from information_schema.columns
          where table_name='subjects' and column_name='class_schedule')
       then 'OK' else 'FALTA -> class-schedule-migration.sql' end
union all select 'tabela attendance',
       case when to_regclass('public.attendance') is not null
       then 'OK' else 'FALTA -> attendance-migration.sql' end
union all select 'study_guides + tasks.guide_id',
       case when to_regclass('public.study_guides') is not null and exists (
         select 1 from information_schema.columns
          where table_name='tasks' and column_name='guide_id')
       then 'OK' else 'FALTA -> study-guides-migration.sql' end
union all select 'tasks.required_pomodoros',
       case when exists (select 1 from information_schema.columns
          where table_name='tasks' and column_name='required_pomodoros')
       then 'OK' else 'FALTA -> task-pomodoros-migration.sql' end
union all select '>> NOVO: profiles.semester_start / semester_end',
       case when exists (select 1 from information_schema.columns
          where table_name='profiles' and column_name='semester_start')
       then 'OK' else 'FALTA -> semester-migration.sql (passo 2)' end
union all select '>> NOVO: subjects.start_date / end_date / skip_dates',
       case when exists (select 1 from information_schema.columns
          where table_name='subjects' and column_name='skip_dates')
       then 'OK' else 'FALTA -> subject-dates-migration.sql (passo 3)' end
union all select 'contas em auth.users (se for 1, os seeds acham sozinhos)',
       (select count(*)::text from auth.users);
