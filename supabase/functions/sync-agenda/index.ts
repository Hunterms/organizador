// Supabase Edge Function: sync-agenda
//
// Traz as reunioes do dia pro organizador, por cron, no servidor.
//
// POR QUE ISTO EXISTE
// Medido no banco em 02/09/2026: o app gera ~19 tarefas/dia e o Hunter fecha
// ~1. A causa que ele mesmo nomeou: o dia dele COMECA com trabalho, e trabalho
// nao esta no app. Ele abre, ve 11 tarefas de casa e nenhuma reuniao, e fecha.
// Um app que mostra um dia que nao e o seu nao ganha adesao planejando melhor.
//
// A integracao ja existia como casca: profiles.work_calendar_ids configurado
// com o calendario da Diletta desde abril, `fetch-ical` escrita e NUNCA
// deployada, o codigo cliente sumido do src/, e 13 tarefas importadas todas em
// 16/04.
//
// POR QUE ICAL E NAO A API DO GOOGLE
// Feed iCal e uma URL: nao expira, nao pede refresh token, e funciona daqui
// sem navegador. OAuth seria tres pecas moveis (client, refresh, storage).
//
// O FEED CEGO, E POR QUE ELE SERVE
// O Workspace da Diletta nao expoe o endereco secreto do iCal, so o publico, e
// o publico esta em "ver apenas livre/ocupado": todo SUMMARY volta como "Busy".
// Decisao do Hunter: ele NAO precisa do titulo, ele sabe qual e a reuniao
// porque esta nela. Precisa que o bloco exista, com hora e duracao, pra poder
// marcar. Entao feed cego e ROTULADO (feed.label), nao recusado.
//
// TETO CONHECIDO: so INSERE. Reuniao cancelada ou movida depois de importada
// fica na lista. Reconciliar exigiria apagar tarefa que ele talvez ja tenha
// fechado, e apagar trabalho registrado e pior que uma linha velha.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// Parser em _shared e .js: o node testa o MESMO arquivo que o Deno importa,
// entao nao existe segunda copia pra divergir. Ver src/lib/ical.test.mjs.
import { parseICS, esforcoDe, semTitulos } from "../_shared/ical.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const TZ = "America/Sao_Paulo";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const fmt = (opts: Intl.DateTimeFormatOptions, d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, ...opts })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );

// Data local. Sem isto, um cron rodando 03:00 UTC criaria a agenda de amanha.
const dataLocal = (d: Date) => {
  const p = fmt({ year: "numeric", month: "2-digit", day: "2-digit" }, d);
  return `${p.year}-${p.month}-${p.day}`;
};
const horaLocal = (ms: number) => {
  const p = fmt({ hour: "2-digit", minute: "2-digit", hour12: false }, new Date(ms));
  return `${p.hour}:${p.minute}`;
};

type Feed = { url?: string; label?: string };

async function sincroniza(admin: ReturnType<typeof createClient>) {
  const hoje = dataLocal(new Date());
  const { data: perfis, error } = await admin.from("profiles").select("id, work_ical_feeds");
  if (error) throw error;

  const relatorio: unknown[] = [];
  for (const p of perfis || []) {
    const feeds: Feed[] = (p as { work_ical_feeds?: Feed[] }).work_ical_feeds || [];
    const uid = (p as { id: string }).id;
    if (!Array.isArray(feeds) || !feeds.length) continue;

    let criadas = 0, vistos = 0;
    const avisos: string[] = [];

    for (const feed of feeds) {
      if (!feed?.url) continue;
      try {
        const r = await fetch(feed.url, { headers: { "User-Agent": "OrganizadorBot/1.0" } });
        if (!r.ok) { avisos.push(`${r.status} em ${feed.url.slice(0, 40)}`); continue; }

        const evs = parseICS(await r.text());
        // So o que COMECA hoje. Evento de dia todo entra sem hora.
        const doDia = evs.filter((e: { inicio: number }) => dataLocal(new Date(e.inicio)) === hoje);
        vistos += doDia.length;
        if (!doDia.length) continue;

        const cego = semTitulos(doDia);
        if (cego && !feed.label) {
          avisos.push("feed sem titulo e sem label: nada pra mostrar");
          continue;
        }

        for (const e of doDia) {
          // Feed cego: o label vale por titulo. Feed com titulo: o titulo vence.
          const titulo = cego ? String(feed.label) : String(e.titulo);
          const { error: e1 } = await admin.from("tasks").insert({
            user_id: uid,
            title: titulo.slice(0, 120),
            category: "trabalho",
            effort: esforcoDe(e.inicio, e.fim),
            time: e.diaTodo ? null : horaLocal(e.inicio),
            date: hoje,
            done: false,
            recurring: false,
            source: "work_calendar",
            ical_uid: e.uid,
            place: e.local || "",
          });
          // 23505 = unique_violation: evento ja importado. Caminho normal
          // quando o cron roda de novo no mesmo dia.
          if (!e1) criadas++;
          else if (e1.code !== "23505") avisos.push(`${e1.code} em ${titulo.slice(0, 24)}`);
        }
      } catch (err) {
        avisos.push(String(err).slice(0, 80));
      }
    }

    await admin.from("profiles").update({
      agenda_last_synced_at: new Date().toISOString(),
      agenda_last_error: avisos.length ? avisos.join(" · ").slice(0, 400) : null,
    }).eq("id", uid);

    relatorio.push({ user: uid, eventos_hoje: vistos, tarefas_criadas: criadas, avisos });
  }
  return { job: "agenda", data: hoje, perfis: relatorio };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Disparo manual pelo app: exige o JWT do proprio usuario.
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
