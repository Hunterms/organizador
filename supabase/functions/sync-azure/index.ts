// Supabase Edge Function: sync-azure
//
// Traz as work items ATIVAS do Azure DevOps pro dia. Roda por cron, no servidor.
//
// POR QUE ESTA E A MELHOR DAS TRES FONTES
// Reuniao vem por iCal (funciona no servidor, mas sem titulo, porque o Workspace
// da Diletta so expoe free/busy). Atividade do Classroom depende do navegador,
// porque o fluxo de token do Google nao da refresh token. O Azure aceita PAT em
// Basic auth: roda as 6:50 sem o Hunter e vem com o titulo real.
//
// O QUE ENTRA, E POR QUE SO ISSO
// Medido em 03/09/2026 com o PAT dele: 29 work items abertas atribuidas a ele.
// Jogar 29 no app seria repetir a doenca — ele ja recebe ~19 tarefas/dia e
// fecha ~1. Entao o filtro e duplo:
//   1. Estado ativo: In Progress, New, Committed. Fora To Do, que e fila.
//   2. Iteracao nao encerrada. Isso derruba o item "In Progress" parado na
//      Sprint 1, que fechou em 01/08/2025, e os 14 To Do na Sprint 6, que
//      fechou em 17/11/2025.
// Sobram ~6, e sao as que ele de fato esta fazendo.
//
// v3 (07/09/2026): O SYNC NAO ESCREVE MAIS NO DIA. As ~6 ativas iam direto pra
// `tasks` e caiam no meio de estudo, casa e terreiro sem ele ter escolhido.
// Agora elas viram CARD no quadro de trabalho, e so viram linha do dia quando o
// estado vira "fazendo" — no app ou no proprio Azure, tanto faz, porque a regra
// mora num lugar so.
//
// A DATA continua sendo hoje quando a linha nasce: work item nao tem due date
// (zero das 29 tem), e empurrar pro fim da sprint faria pilha na segunda.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const ORG = "cpfseguro";
const TZ = "America/Sao_Paulo";
const ATIVOS = ["In Progress", "New", "Committed"];

// Estados que significam "comecou", e por isso rendem linha no dia. Nao da pra
// usar so "In Progress": Task anda To Do -> In Progress e Product Backlog Item
// anda New -> Approved -> Committed. Pra ele os dois querem dizer a mesma coisa.
// Esta lista e a MESMA da funcao azure-item de proposito: se as duas
// discordarem, o cron desfaz de madrugada o que ele fez de tarde.
const FAZENDO = new Set(["in progress", "active", "committed", "doing"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const hojeLocal = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
};

const ado = (pat: string) => ({
  Authorization: `Basic ${btoa(":" + pat)}`,
  "Content-Type": "application/json",
});

/**
 * Caminhos das iteracoes CORRENTES. Decisao do Hunter em 03/09/2026: so entra
 * o que esta na sprint corrente. Isso descarta tres coisas de uma vez: sprint
 * encerrada, sprint futura, e item na RAIZ do projeto (sem iteracao nenhuma).
 *
 * O que ele perde com isso, e ele sabe: 3 itens ativos que estao em
 * `CPF Seguro` sem sprint (#863 Revisao regulatorio do Pix, #3137 e #3138).
 * Se deveriam contar, o lugar de arrastar pra Sprint 20 e o Azure, nao aqui.
 *
 * Comparacao por PATH, nunca por nome: "Sprint 1" do CPF Seguro fechou em
 * 08/2025 e "Sprint 1" do HDSC e a corrente.
 */
async function iteracoesCorrentes(pat: string, projetos: string[]) {
  const atuais = new Set<string>();
  for (const proj of projetos) {
    try {
      const r = await fetch(
        `https://dev.azure.com/${ORG}/${encodeURIComponent(proj)}/_apis/work/teamsettings/iterations?api-version=7.1`,
        { headers: ado(pat) },
      );
      if (!r.ok) continue;
      const d = await r.json();
      for (const it of d.value || []) {
        if (it?.attributes?.timeFrame === "current" && it.path) atuais.add(it.path);
      }
    } catch { /* projeto sem time configurado: nao derruba o resto */ }
  }
  return atuais;
}

/**
 * Os estados legais do tipo, lidos do proprio Azure. Sao eles que viram as
 * colunas do quadro. Colunas fixas no codigo recusariam metade dos cards, porque
 * Task e Product Backlog Item nao andam pelos mesmos estados.
 *
 * O cache e por projeto+tipo porque a resposta e a mesma pras ~6 work items de
 * uma rodada: sem ele, seis idas de rede pra buscar duas listas.
 */
async function estadosDoTipo(pat: string, proj: string, tipo: string, cache: Map<string, string[]>) {
  const chave = `${proj}::${tipo}`;
  if (cache.has(chave)) return cache.get(chave)!;
  let nomes: string[] = [];
  try {
    const r = await fetch(
      `https://dev.azure.com/${ORG}/${encodeURIComponent(proj)}/_apis/wit/workitemtypes/${encodeURIComponent(tipo)}/states?api-version=7.1`,
      { headers: ado(pat) },
    );
    if (r.ok) nomes = ((await r.json()).value || []).map((s: { name: string }) => s.name);
  } catch { /* sem os estados o card ainda aparece, so nao oferece destino */ }
  cache.set(chave, nomes);
  return nomes;
}

async function sincroniza() {
  const hoje = hojeLocal();
  const { data: segredos, error } = await admin
    .from("integracao_segredos").select("user_id, valor").eq("chave", "azure_pat");
  if (error) throw error;

  const relatorio: unknown[] = [];
  for (const s of segredos || []) {
    const uid = (s as { user_id: string }).user_id;
    const pat = (s as { valor: string }).valor;
    const avisos: string[] = [];
    let criadas = 0, descartadas = 0, movidas = 0, cards = 0, removidas = 0;

    try {
      const estados = ATIVOS.map((e) => `'${e}'`).join(",");
      const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me`
        + ` AND [System.State] IN (${estados}) ORDER BY [System.ChangedDate] DESC`;
      const rq = await fetch(`https://dev.azure.com/${ORG}/_apis/wit/wiql?api-version=7.1&$top=100`, {
        method: "POST", headers: ado(pat), body: JSON.stringify({ query: wiql }),
      });
      if (!rq.ok) throw new Error(`wiql ${rq.status}`);
      const ids = ((await rq.json()).workItems || []).map((w: { id: number }) => w.id);
      if (!ids.length) { relatorio.push({ user: uid, ativas: 0, criadas: 0 }); continue; }

      const campos = [
        "System.Id", "System.Title", "System.State", "System.WorkItemType",
        "System.TeamProject", "System.IterationPath", "System.Tags",
        "Microsoft.VSTS.CMMI.Blocked",
      ].join(",");
      const rd = await fetch(
        `https://dev.azure.com/${ORG}/_apis/wit/workitems?ids=${ids.join(",")}&fields=${campos}&api-version=7.1`,
        { headers: ado(pat) },
      );
      if (!rd.ok) throw new Error(`workitems ${rd.status}`);
      const itens = ((await rd.json()).value || []) as { id: number; fields: Record<string, string> }[];

      const projetos = [...new Set(itens.map((i) => i.fields["System.TeamProject"]).filter(Boolean))];
      const correntes = await iteracoesCorrentes(pat, projetos);
      const cacheEstados = new Map<string, string[]>();

      // Tarefas do dia que sync anterior criou. Sao consultadas pra decidir se a
      // linha de hoje precisa nascer, morrer ou ficar quieta.
      const { data: jaTem } = await admin
        .from("tasks").select("id, ical_uid, date, done")
        .eq("user_id", uid).like("ical_uid", "ado-%");
      const porUid = new Map((jaTem || []).map((t) => [(t as { ical_uid: string }).ical_uid, t]));

      const vistos: number[] = [];

      for (const it of itens) {
        const f = it.fields;
        const iter = f["System.IterationPath"];
        // Fora da sprint corrente nao entra: isso cobre sprint encerrada,
        // sprint futura, e item na raiz do projeto (sem iteracao nenhuma).
        if (!iter || !correntes.has(iter)) { descartadas++; continue; }

        const proj = f["System.TeamProject"];
        const tipo = f["System.WorkItemType"];
        const estado = f["System.State"];
        const esforco = tipo === "Product Backlog Item" ? "120" : "60";
        vistos.push(it.id);

        // Bloqueio chega por dois caminhos porque nao e universal: processo
        // Scrum tem o campo Blocked, processo Agile nao tem e o time usa tag.
        // Ler os dois aqui evita perguntar antes qual processo o projeto usa.
        const bloqueado = String(f["Microsoft.VSTS.CMMI.Blocked"] || "").toLowerCase() === "yes"
          || String(f["System.Tags"] || "").toLowerCase().split(";").some((t) => t.trim() === "blocked");

        // O CARD. Uma linha por work item, chaveada por (user_id, ado_id), que e
        // o indice unico da migracao. Sem essa chave o mesmo item viraria card
        // novo a cada rodada — foi o que a v1 fez com as tarefas.
        const { error: eCard } = await admin.from("kanban_cards").upsert({
          user_id: uid,
          title: `#${it.id} ${f["System.Title"]}`.slice(0, 200),
          project: proj,
          effort: esforco,
          column_name: estado,
          source: "azure",
          ado_id: it.id,
          ado_type: tipo,
          ado_url: `https://dev.azure.com/${ORG}/${encodeURIComponent(proj)}/_workitems/edit/${it.id}`,
          iteration: iter,
          blocked: bloqueado,
          states: await estadosDoTipo(pat, proj, tipo, cacheEstados),
          synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,ado_id" });
        if (eCard) { avisos.push(`${eCard.code} no card #${it.id}`); continue; }
        cards++;

        // A LINHA DO DIA. Nasce so quando o item esta sendo feito — foi o pedido
        // dele: o quadro e a fila, o dia e o que ele pegou pra fazer. Vale
        // igual pra quem move o card aqui e pra quem move no Azure.
        const uidTarefa = `ado-${it.id}`;
        const antiga = porUid.get(uidTarefa) as { id: string; date: string; done: boolean } | undefined;
        const fazendo = FAZENDO.has(String(estado).toLowerCase());

        if (fazendo && !antiga) {
          const { error: e1 } = await admin.from("tasks").insert({
            user_id: uid,
            title: `#${it.id} ${f["System.Title"]}`.slice(0, 200),
            category: "trabalho", effort: esforco, date: hoje,
            done: false, recurring: false, source: "work_calendar",
            ical_uid: uidTarefa,
          });
          if (!e1) criadas++;
          else if (e1.code !== "23505") avisos.push(`${e1.code} em #${it.id}`);
        } else if (fazendo && antiga && !antiga.done && antiga.date !== hoje) {
          // Continua em andamento e nao foi fechada: a linha acompanha o hoje,
          // em vez de virar divida de ontem.
          const { error: e2 } = await admin.from("tasks").update({ date: hoje }).eq("id", antiga.id);
          if (!e2) movidas++; else avisos.push(`${e2.code} movendo #${it.id}`);
        } else if (!fazendo && antiga && !antiga.done) {
          // Voltou pra fila: perde o lugar no dia. So a que ele nao fechou —
          // se marcou feita, foi decisao dele e nao se apaga.
          await admin.from("tasks").delete().eq("id", antiga.id);
          removidas++;
        }
      }

      // Item que saiu dos ativos ou da sprint corrente sai do quadro. O quadro
      // mostra o que esta em jogo agora; historico e no Azure, que guarda.
      const { data: orfaos } = await admin.from("kanban_cards")
        .select("ado_id").eq("user_id", uid).eq("source", "azure");
      const sumiram = (orfaos || [])
        .map((c) => (c as { ado_id: number }).ado_id)
        .filter((n) => n && !vistos.includes(n));
      if (sumiram.length) {
        await admin.from("kanban_cards").delete().eq("user_id", uid).in("ado_id", sumiram);
      }

      relatorio.push({ user: uid, ativas: itens.length, cards, criadas, movidas, removidas, descartadas, saidas: sumiram.length, avisos });
    } catch (e) {
      relatorio.push({ user: uid, erro: String(e).slice(0, 120) });
    }
  }
  return { job: "azure", data: hoje, perfis: relatorio };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));

    if (body.test) {
      const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      const { data: { user } } = await admin.auth.getUser(jwt);
      if (!user) return json({ error: "unauthorized" }, 401);
      return json(await sincroniza());
    }
    if (body.cron && CRON_SECRET && body.cron === CRON_SECRET) {
      return json(await sincroniza());
    }
    return json({ error: "nothing to do" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
