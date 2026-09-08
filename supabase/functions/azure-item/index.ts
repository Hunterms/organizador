// Supabase Edge Function: azure-item
//
// O BRACO DO APP DENTRO DO AZURE. Estado, comentario, anexo, bloqueio e
// subtarefa saem daqui e vao pro Azure na hora, com o PAT dele.
//
// POR QUE PROXY, E NAO ESPELHO
// A tentacao era copiar comentario e anexo pra dentro do Supabase e mostrar a
// copia. Duas fontes escrevendo a mesma coisa divergem no primeiro dia em que
// alguem comenta pelo navegador do Azure — e ai o app mente com cara de certo.
// Entao NADA de conversa e arquivo mora aqui: a tela pede, esta funcao busca no
// Azure, devolve, e esquece. O que fica em `kanban_cards` e so o cache do que a
// LISTA precisa desenhar (titulo, estado, tipo), pro board abrir sem rede.
//
// POR QUE O PAT NAO VAI PRO NAVEGADOR
// Um PAT com escopo de escrita em Work Items cria e fecha item em nome dele em
// toda a organizacao. Ele fica em `integracao_segredos`, lido com service role,
// e o navegador so manda o JWT dele. Se um dia o app for pra web publica, o
// segredo continua deste lado da parede.
//
// ESCOPO DO PAT: precisa de vso.work_write (Work Items: Read & write). O da
// v2 era so leitura. PATCH com PAT de leitura volta 403 com corpo vazio, que e
// facil de ler como "deu ruim" generico — por isso o 403 aqui vira mensagem
// nomeando o escopo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const ORG = "cpfseguro";
const TZ = "America/Sao_Paulo";

// Estados que significam "comecou". Nao da pra usar so "In Progress": Task anda
// To Do -> In Progress, mas Product Backlog Item anda New -> Approved ->
// Committed. Os dois querem dizer a mesma coisa pra ele, e e essa a virada que
// poe a linha no dia.
const FAZENDO = new Set(["in progress", "active", "committed", "doing"]);
const FECHADO = new Set(["done", "closed", "resolved", "completed", "removed"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const hojeLocal = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
};

const auth = (pat: string) => `Basic ${btoa(":" + pat)}`;

/** Chama o Azure e traduz a falha em algo que a tela consegue mostrar. */
async function azure(pat: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: auth(pat), ...(init.headers || {}) },
  });
  if (r.status === 403 || r.status === 401) {
    throw new Error("O PAT nao tem escopo de escrita em Work Items (vso.work_write). Gere outro no Azure com Read & write.");
  }
  if (!r.ok) {
    // O Azure devolve o motivo em JSON com `message`; sem isso vira "500" seco.
    const txt = await r.text().catch(() => "");
    let msg = `${r.status}`;
    try { msg = JSON.parse(txt).message || msg; } catch { if (txt) msg = txt.slice(0, 200); }
    throw new Error(msg);
  }
  return r.status === 204 ? null : await r.json();
}

const patch = (pat: string, url: string, ops: unknown[]) =>
  azure(pat, url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json-patch+json" },
    body: JSON.stringify(ops),
  });

/**
 * Comentario e API de PREVIEW, e a versao anda. A 7.0 documentada e
 * `7.0-preview.3`; a 7.1 responde em `7.1-preview.4`. Chutar uma so das duas da
 * 400 num dia qualquer sem nada mudar do nosso lado, entao tenta a nova e cai
 * pra velha. Sao tres linhas contra uma quebra silenciosa.
 */
async function comentarios(pat: string, proj: string, id: number, texto?: string) {
  const base = `https://dev.azure.com/${ORG}/${encodeURIComponent(proj)}/_apis/wit/workItems/${id}/comments`;
  const init: RequestInit = texto
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: texto }) }
    : {};
  for (const v of ["7.1-preview.4", "7.0-preview.3"]) {
    try { return await azure(pat, `${base}?api-version=${v}`, init); }
    catch (e) { if (String(e).includes("escopo")) throw e; }
  }
  throw new Error("API de comentarios recusou as duas versoes de preview");
}

/** Os estados legais do TIPO do item, lidos do Azure. E o que o board oferece. */
async function estadosDoTipo(pat: string, proj: string, tipo: string) {
  const d = await azure(
    pat,
    `https://dev.azure.com/${ORG}/${encodeURIComponent(proj)}/_apis/wit/workitemtypes/${encodeURIComponent(tipo)}/states?api-version=7.1`,
  );
  return ((d?.value || []) as { name: string }[]).map((s) => s.name);
}

/**
 * Espelha o estado no card e decide se a linha existe no dia de hoje.
 * E AQUI que mora o pedido dele: work item so vira tarefa quando ele move pra
 * Doing. Sai de Doing e a linha some do dia — nao fica lixo de ontem.
 */
async function refleteNoApp(
  uid: string, id: number, estado: string, titulo: string, esforco: string,
) {
  await admin.from("kanban_cards")
    .update({ column_name: estado, synced_at: new Date().toISOString() })
    .eq("user_id", uid).eq("ado_id", id);

  const uidTarefa = `ado-${id}`;
  const e = estado.toLowerCase();
  const { data: existe } = await admin.from("tasks")
    .select("id, done").eq("user_id", uid).eq("ical_uid", uidTarefa).maybeSingle();

  if (FAZENDO.has(e)) {
    if (!existe) {
      await admin.from("tasks").insert({
        user_id: uid, title: `#${id} ${titulo}`.slice(0, 200), category: "trabalho",
        effort: esforco, date: hojeLocal(), done: false, recurring: false,
        source: "work_calendar", ical_uid: uidTarefa,
      });
    }
    return "criada";
  }
  if (FECHADO.has(e) && existe && !(existe as { done: boolean }).done) {
    await admin.from("tasks").update({ done: true }).eq("id", (existe as { id: string }).id);
    return "fechada";
  }
  // Voltou pra New/To Do: a linha de hoje perde o motivo de existir. So remove
  // a que ele nao fechou; se ele marcou feita, foi decisao dele.
  if (existe && !(existe as { done: boolean }).done) {
    await admin.from("tasks").delete().eq("id", (existe as { id: string }).id);
    return "removida";
  }
  return "sem mudanca";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: seg } = await admin.from("integracao_segredos")
      .select("valor").eq("user_id", user.id).eq("chave", "azure_pat").maybeSingle();
    const pat = (seg as { valor: string } | null)?.valor;
    if (!pat) return json({ error: "sem PAT do Azure salvo" }, 400);

    const body = await req.json().catch(() => ({}));
    const { action, id } = body as { action: string; id: number };
    if (!action) return json({ error: "sem action" }, 400);

    // O projeto vem do card, que o sync ja gravou. Buscar de novo no Azure a
    // cada acao seria uma ida de rede pra descobrir algo que nao muda.
    const { data: card } = await admin.from("kanban_cards")
      .select("project, ado_type, title, effort").eq("user_id", user.id).eq("ado_id", id).maybeSingle();
    const proj = (card as { project: string } | null)?.project;
    const wi = `https://dev.azure.com/${ORG}/_apis/wit/workitems/${id}?api-version=7.1`;

    switch (action) {
      // A tela do item: campos, conversa, anexos e filhos numa ida so.
      case "get": {
        const [item, cs] = await Promise.all([
          azure(pat, `${wi}&$expand=relations`),
          proj ? comentarios(pat, proj, id).catch(() => ({ comments: [] })) : Promise.resolve({ comments: [] }),
        ]);
        const rel = (item.relations || []) as { rel: string; url: string; attributes?: Record<string, string> }[];
        return json({
          fields: item.fields,
          // O link de download exige o mesmo PAT, entao a tela nao consegue
          // abrir direto: manda pro item no Azure, que ja sabe autenticar.
          anexos: rel.filter((r) => r.rel === "AttachedFile")
            .map((r) => ({ nome: r.attributes?.name, url: r.url, tamanho: r.attributes?.resourceSize })),
          filhos: rel.filter((r) => r.rel === "System.LinkTypes.Hierarchy-Forward")
            .map((r) => Number(r.url.split("/").pop())),
          comentarios: (cs.comments || []).map((c: Record<string, unknown>) => ({
            id: c.id, texto: c.text,
            autor: (c.createdBy as { displayName: string })?.displayName, em: c.createdDate,
          })),
          web: `https://dev.azure.com/${ORG}/${encodeURIComponent(proj || "")}/_workitems/edit/${id}`,
        });
      }

      case "estados":
        if (!proj) return json({ error: "card sem projeto" }, 400);
        return json({ estados: await estadosDoTipo(pat, proj, (card as { ado_type: string }).ado_type) });

      case "state": {
        const novo = String(body.state || "");
        if (!novo) return json({ error: "sem state" }, 400);
        await patch(pat, wi, [{ op: "add", path: "/fields/System.State", value: novo }]);
        const c = card as { title: string; effort: string } | null;
        const efeito = await refleteNoApp(user.id, id, novo, c?.title?.replace(/^#\d+\s*/, "") || "", c?.effort || "60");
        return json({ ok: true, state: novo, tarefa: efeito });
      }

      // Bloqueio nao e universal: o processo Scrum tem o campo Blocked, o Agile
      // nao tem e o time usa tag. Tenta o campo; se o Azure recusar, marca a
      // tag, que existe em qualquer processo. Assim funciona nos dois sem
      // perguntar antes qual processo o projeto usa.
      case "blocked": {
        const on = !!body.blocked;
        try {
          await patch(pat, wi, [{ op: "add", path: "/fields/Microsoft.VSTS.CMMI.Blocked", value: on ? "Yes" : "No" }]);
        } catch (e) {
          if (String(e).includes("escopo")) throw e;
          const atual = await azure(pat, wi);
          const tags = String(atual.fields["System.Tags"] || "").split(";").map((t: string) => t.trim()).filter(Boolean);
          const semBloqueio = tags.filter((t: string) => t.toLowerCase() !== "blocked");
          await patch(pat, wi, [{
            op: "add", path: "/fields/System.Tags",
            value: (on ? [...semBloqueio, "Blocked"] : semBloqueio).join("; "),
          }]);
        }
        await admin.from("kanban_cards").update({ blocked: on })
          .eq("user_id", user.id).eq("ado_id", id);
        return json({ ok: true, blocked: on });
      }

      case "comment": {
        if (!proj) return json({ error: "card sem projeto" }, 400);
        const texto = String(body.text || "").trim();
        if (!texto) return json({ error: "comentario vazio" }, 400);
        const c = await comentarios(pat, proj, id, texto);
        return json({ ok: true, id: c.id });
      }

      // Subtarefa nasce no Azure ja pendurada no pai. O link vai no MESMO POST
      // que cria: criar solto e ligar depois deixa item orfao no board do time
      // toda vez que a segunda chamada falha.
      case "subtask": {
        if (!proj) return json({ error: "card sem projeto" }, 400);
        const titulo = String(body.title || "").trim();
        if (!titulo) return json({ error: "subtarefa sem titulo" }, 400);
        const tipo = String(body.type || "Task");
        const novo = await azure(
          pat,
          `https://dev.azure.com/${ORG}/${encodeURIComponent(proj)}/_apis/wit/workitems/$${encodeURIComponent(tipo)}?api-version=7.1`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json-patch+json" },
            body: JSON.stringify([
              { op: "add", path: "/fields/System.Title", value: titulo.slice(0, 255) },
              {
                op: "add", path: "/relations/-",
                value: {
                  rel: "System.LinkTypes.Hierarchy-Reverse",
                  url: `https://dev.azure.com/${ORG}/_apis/wit/workItems/${id}`,
                },
              },
            ]),
          },
        );
        return json({ ok: true, id: novo.id, title: titulo });
      }

      // Anexo em dois passos, que e como o Azure quer: sobe o arquivo solto,
      // depois amarra no item. O arquivo chega em base64 porque o corpo aqui e
      // JSON; e por isso que o teto e baixo de proposito.
      case "attach": {
        const nome = String(body.name || "arquivo");
        const b64 = String(body.data || "");
        if (!b64) return json({ error: "sem arquivo" }, 400);
        if (b64.length > 8_000_000) return json({ error: "arquivo grande demais (limite ~6 MB)" }, 413);
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const up = await azure(
          pat,
          `https://dev.azure.com/${ORG}/${proj ? encodeURIComponent(proj) + "/" : ""}_apis/wit/attachments?fileName=${encodeURIComponent(nome)}&api-version=7.1`,
          { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: bytes },
        );
        await patch(pat, wi, [{ op: "add", path: "/relations/-", value: { rel: "AttachedFile", url: up.url, attributes: { name: nome } } }]);
        return json({ ok: true, nome, url: up.url });
      }

      default:
        return json({ error: `action desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String(e).replace(/^Error:\s*/, "") }, 400);
  }
});
