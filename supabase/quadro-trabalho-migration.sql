-- ==========================================================================
-- O Azure vira QUADRO, e so entra no dia quando ele mover pra Doing.
--
-- O PROBLEMA
-- A v2 do sync-azure escrevia direto em `tasks`: toda work item ativa da sprint
-- virava tarefa do dia, com a data seguindo o hoje ate ele fechar. Isso deixava
-- ~6 linhas de trabalho misturadas com estudo, casa e terreiro, que ele nao
-- escolheu colocar la. Decisao dele em 07/09/2026: trabalho e quadro a parte, e
-- so vira tarefa do dia quando ELE mover o card pra In Progress.
--
-- POR QUE REAPROVEITAR kanban_cards
-- A tabela existe desde o schema inicial, ja tem RLS, ja e carregada no store,
-- ja tem create/move/delete escritos — e NENHUM componente usa. Era feature
-- morta. Criar uma tabela nova ao lado deixaria duas: uma morta e uma viva.
--
-- POR QUE A COLUNA E UM ESTADO DO AZURE, E NAO todo/doing/done
-- Ele opera pelo Azure: comentario, anexo, bloqueio, subtarefa. Se a coluna
-- daqui fosse do app, ele teria que mexer no estado duas vezes e as duas
-- divergiriam no primeiro dia. O Azure e a fonte; o card e cache da lista.
--
-- POR QUE `states` POR CARD, E NAO COLUNAS FIXAS NO CODIGO
-- Tipo diferente tem estado diferente: Task anda To Do -> In Progress -> Done,
-- Product Backlog Item anda New -> Approved -> Committed -> Done. Um board de
-- colunas fixas recusaria metade dos cards. Entao cada card carrega os estados
-- legais DO TIPO DELE, lidos do proprio Azure no sync, e o board so oferece o
-- destino que aquele card aceita.
-- ==========================================================================

alter table public.kanban_cards
  add column if not exists source    text not null default 'manual',
  add column if not exists ado_id    int,
  add column if not exists ado_type  text,
  add column if not exists ado_url   text,
  add column if not exists iteration text,
  add column if not exists parent_id int,
  add column if not exists blocked   boolean not null default false,
  add column if not exists states    jsonb,
  add column if not exists synced_at timestamptz;

-- column_name deixa de ser um enum de tres: passa a guardar o estado real do
-- Azure, que varia por processo (Scrum, Agile, CMMI) e por tipo. Validar isso
-- aqui seria copiar pro Postgres uma tabela que muda no Azure sem avisar; quem
-- valida e o proprio Azure, que recusa o PATCH. Cards manuais seguem em
-- todo/doing/done, que continuam validos porque agora nada e recusado.
alter table public.kanban_cards drop constraint if exists kanban_cards_column_name_check;

-- effort so aceitava 30/60/120. Work item entra com o tamanho do tipo dele e
-- nao cabe sempre nesses tres.
alter table public.kanban_cards drop constraint if exists kanban_cards_effort_check;

alter table public.kanban_cards drop constraint if exists kanban_cards_source_check;
alter table public.kanban_cards add constraint kanban_cards_source_check
  check (source in ('manual','azure'));

-- Uma linha por work item por usuario. E a licao que a v1 do sync pagou caro:
-- sem chave estavel, o mesmo item virava registro novo a cada rodada.
--
-- O INDICE NAO PODE SER PARCIAL. A primeira versao daqui tinha
-- `where ado_id is not null`, que parece mais limpo e custou uma rodada inteira
-- de sync: `ON CONFLICT (user_id, ado_id)` nao infere indice parcial sem repetir
-- o predicado, e o PostgREST manda o on_conflict seco. Deu 42P10 em todo card,
-- e o sync ainda apagou 6 cards como "sumiram do Azure", porque o erro pulou
-- o item antes de ele entrar na lista dos vistos. Indice cheio nao custa nada:
-- no Postgres NULL e distinto de NULL, entao os cards manuais convivem.
create unique index if not exists kanban_ado_uniq
  on public.kanban_cards(user_id, ado_id);

-- ---------------------------------------------------------------------------
-- Uma vez: as tarefas que a v2 do sync criou em `tasks` viram cards do quadro.
-- As que ele ja marcou feitas ficam onde estao — ele decidiu que acabaram, e
-- apagar isso seria reescrever o historico dele.
-- ---------------------------------------------------------------------------
insert into public.kanban_cards (user_id, title, effort, column_name, source, ado_id)
select t.user_id, t.title, coalesce(t.effort,'60'), 'New', 'azure',
       (regexp_replace(t.ical_uid, '^ado-', ''))::int
from public.tasks t
where t.ical_uid like 'ado-%'
  and t.done = false
  and t.ical_uid ~ '^ado-[0-9]+$'
on conflict do nothing;

delete from public.tasks where ical_uid like 'ado-%' and done = false;
