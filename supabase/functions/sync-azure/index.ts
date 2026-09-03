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
// A DATA E HOJE, e nao o fim da sprint. Work item nao tem due date (zero das 29
// tem). Colocar as 6 no ultimo dia da sprint faria uma pilha na segunda; poe
// hoje, e o proximo sync repoe. Fechou, some da lista do dia seguinte.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const ORG = "cpfseguro";
const TZ = "America/Sao_Paulo";
const ATIVOS = ["In Progress", "New", "Committed"];

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

async function sincroniza(admin: ReturnType<typeof createClient>) {
  const hoje = hojeLocal();
  const { data: segredos, error } = await admin
    .from("integracao_segredos").select("user_id, valor").eq("chave", "azure_pat");
  if (error) throw error;

  const relatorio: unknown[] = [];
  for (const s of segredos || []) {
    const uid = (s as { user_id: string }).user_id;
    const pat = (s as { valor: string }).valor;
    const avisos: string[] = [];
    let criadas = 0, descartadas = 0, movidas = 0;

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
        "System.TeamProject", "System.IterationPath",
      ].join(",");
      const rd = await fetch(
        `https://dev.azure.com/${ORG}/_apis/wit/workitems?ids=${ids.join(",")}&fields=${campos}&api-version=7.1`,
        { headers: ado(pat) },
      );
      if (!rd.ok) throw new Error(`workitems ${rd.status}`);
      const itens = ((await rd.json()).value || []) as { id: number; fields: Record<string, string> }[];

      const projetos = [...new Set(itens.map((i) => i.fields["System.TeamProject"]).filter(Boolean))];
      const correntes = await iteracoesCorrentes(pat, projetos);

      // Tarefas que este sync ja criou antes, pra mover a data em vez de
      // duplicar. A v1 punha a data na chave (`ado-863-2026-09-03`), entao o
      // mesmo item virava tarefa nova TODO DIA: em cinco dias o #863 existia
      // cinco vezes, em cinco datas, nenhuma feita. Era a pilha de novo, com
      // fonte nova.
      const { data: jaTem } = await admin
        .from("tasks").select("id, ical_uid, date, done")
        .eq("user_id", uid).like("ical_uid", "ado-%");
      const porUid = new Map((jaTem || []).map((t) => [(t as { ical_uid: string }).ical_uid, t]));

      for (const it of itens) {
        const f = it.fields;
        const iter = f["System.IterationPath"];
        // Fora da sprint corrente nao entra: isso cobre sprint encerrada,
        // sprint futura, e item na raiz do projeto (sem iteracao nenhuma).
        if (!iter || !correntes.has(iter)) { descartadas++; continue; }

        // Uma linha por work item, e a DATA SEGUE O HOJE enquanto ele nao
        // fechar. Work item ativo E o trabalho de hoje ate deixar de ser.
        // Marcado como feito no app: nao mexe, ele decidiu que acabou.
        const uidTarefa = `ado-${it.id}`;
        const antiga = porUid.get(uidTarefa) as { id: string; date: string; done: boolean } | undefined;
        if (antiga) {
          if (!antiga.done && antiga.date !== hoje) {
            const { error: e2 } = await admin.from("tasks")
              .update({ date: hoje }).eq("id", antiga.id);
            if (!e2) movidas++; else avisos.push(`${e2.code} movendo #${it.id}`);
          }
          continue;
        }

        const { error: e1 } = await admin.from("tasks").insert({
          user_id: uid,
          title: `#${it.id} ${f["System.Title"]}`.slice(0, 200),
          category: "trabalho",
          effort: f["System.WorkItemType"] === "Product Backlog Item" ? "120" : "60",
          date: hoje,
          done: false,
          recurring: false,
          source: "work_calendar",
          // Chave estavel por work item, SEM a data: e ela que garante uma
          // linha so por item, em vez de uma por item por dia.
          ical_uid: uidTarefa,
        });
        if (!e1) criadas++;
        else if (e1.code !== "23505") avisos.push(`${e1.code} em #${it.id}`);
      }
      relatorio.push({ user: uid, ativas: itens.length, criadas, movidas, descartadas, avisos });
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
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (body.test) {
      const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      const { data: { user } } = await admin.auth.getUser(jwt);
      if (!user) return json({ error: "unauthorized" }, 401);
      return json(await sincroniza(admin));
    }
    if (body.cron && CRON_SECRET && body.cron === CRON_SECRET) {
      return json(await sincroniza(admin));
    }
    return json({ error: "nothing to do" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
