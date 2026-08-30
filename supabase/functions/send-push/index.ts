// Supabase Edge Function: send-push
// Sends Web Push notifications via VAPID.
//
// Modes (POST body):
//   { test: true }                     → caller (from JWT) gets a test push.
//   { cron: "<CRON_SECRET>", job: "digest" } → morning summary per user.
//   { cron: "<CRON_SECRET>", job: "timed" }  → reminders for tasks due soon.
//
// Secrets (Project → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hunter.soares.c@gmail.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const TZ = "America/Sao_Paulo";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

// Casa routine default labels — must match Casa.jsx / store.js.
const DEFAULT_ROOM_LABELS: Record<string, string> = {
  areia_gato: "Limpar areia do gato", comida_gato: "Dar comida pro gato",
  sala: "Limpar sala", quarto: "Arrumar quarto", escritorio: "Organizar escritorio",
  banheiro: "Limpar banheiro", lavanderia: "Lavar roupas",
  lixo_organico: "Descer lixo organico", lixo_reciclavel: "Descer lixo reciclavel",
};
const REVIEW_OFFSETS = [-18, -7, -5, -3, -2];

// A task counts as done only when checked AND its pomodoro requirement is met.
const effDone = (t: { done?: boolean; required_pomodoros?: number; pomodoros_done?: number }) =>
  !!t.done && ((t.required_pomodoros || 0) === 0 || (t.pomodoros_done || 0) >= (t.required_pomodoros || 0));

// Streak with the floor (>=80% tasks OR >=1 focus pomodoro) and 2 shields/month
// (mirror of lib/gamification.js computeProgress).
function streakOf(
  tasks: Array<{ date?: string; done?: boolean; required_pomodoros?: number; pomodoros_done?: number }>,
  focus: Record<string, number>,
  today: string,
) {
  const byDate: Record<string, { total: number; done: number }> = {};
  for (const t of tasks) {
    if (!t.date) continue;
    (byDate[t.date] ||= { total: 0, done: 0 }).total++;
    if (effDone(t)) byDate[t.date].done++;
  }
  const dates = [...Object.keys(byDate), ...Object.keys(focus)];
  if (!dates.length) return 0;
  const kept = (d: string) => {
    const r = byDate[d];
    return (!!r && r.total > 0 && r.done / r.total >= 0.8) || (focus[d] || 0) >= 1;
  };
  const start = dates.sort()[0];
  const next = (s: string) => { const x = new Date(s + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
  let run = 0, month = "", ms = 0;
  for (let d = start; d <= today; d = next(d)) {
    const mo = d.slice(0, 7);
    if (mo !== month) { month = mo; ms = 0; }
    if (kept(d)) run++;
    else if (d === today) { /* in progress */ }
    else if (ms < 2) ms++;
    else run = 0;
  }
  return run;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

type Admin = ReturnType<typeof createClient>;

// Current date + minute-of-day in the user's timezone.
function nowLocal() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = parseInt(parts.hour) * 60 + parseInt(parts.minute);
  return { date, minutes };
}

const toUTCDate = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const daysBetween = (a: string, b: string) => Math.round((toUTCDate(a) - toUTCDate(b)) / 86400000);
function addDays(s: string, n: number) {
  const d = new Date(toUTCDate(s) + n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
const weekday = (s: string) => new Date(`${s}T12:00:00Z`).getUTCDay();
const parseHHMM = (t: string) => { const [h, m] = t.split(":"); return (+h) * 60 + (+m); };

// Deliver one payload to every subscription of the given users. Cleans up
// subscriptions the push service reports gone (404/410).
async function deliver(admin: Admin, userIds: string[], payload: unknown) {
  const { data: subs } = await admin
    .from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", userIds);
  let sent = 0, removed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removed++;
      } else console.error("push send failed:", code, String(e));
    }
  }
  return { sent, removed };
}

async function subscribedUserIds(admin: Admin): Promise<string[]> {
  const { data } = await admin.from("push_subscriptions").select("user_id");
  return [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))];
}

// User's wake/sleep hours (defaults 7/22). Drives when the digest fires and the
// awake window for water/timed reminders.
async function sleepPrefs(admin: Admin, uid: string) {
  const { data } = await admin.from("profiles").select("wake_hour, sleep_hour, water_goal, bottle_size").eq("id", uid).maybeSingle();
  const d = data as { wake_hour?: number; sleep_hour?: number; water_goal?: number; bottle_size?: number } | null;
  return { wake: d?.wake_hour ?? 7, sleep: d?.sleep_hour ?? 22, goal: d?.water_goal ?? 0, size: d?.bottle_size ?? 700 };
}

// Ensure today's home-routine items exist as casa tasks (same as the client
// does on open — but server-side, so the board is ready each morning).
async function materializeRoutine(admin: Admin, userId: string, today: string) {
  const dow = weekday(today);
  const [{ data: routine }, { data: custom }, { data: existing }] = await Promise.all([
    admin.from("home_routine").select("room_key, days, category, time, effort").eq("user_id", userId),
    admin.from("custom_rooms").select("key, label").eq("user_id", userId),
    admin.from("tasks").select("title").eq("user_id", userId).eq("date", today),
  ]);
  const have = new Set((existing ?? []).map((t: { title: string }) => t.title.toLowerCase()));
  const labelOf = (key: string) =>
    DEFAULT_ROOM_LABELS[key] || (custom ?? []).find((c: { key: string }) => c.key === key)?.label || null;
  const rows = [];
  for (const r of routine ?? []) {
    if (!Array.isArray(r.days) || !r.days.includes(dow)) continue;
    const title = labelOf(r.room_key);
    if (!title || have.has(title.toLowerCase())) continue;
    have.add(title.toLowerCase());
    rows.push({ user_id: userId, title, category: r.category ?? "casa", effort: r.effort ?? "30",
                time: r.time ?? null, done: false, date: today, recurring: true });
  }
  if (rows.length) await admin.from("tasks").insert(rows);
}

// Morning digest: materialize routine, then summarize today for each user.
async function runDigest(admin: Admin) {
  const { date: today, minutes } = nowLocal();
  const hour = Math.floor(minutes / 60);
  const users = await subscribedUserIds(admin);
  let delivered = 0;
  for (const uid of users) {
    const { wake } = await sleepPrefs(admin, uid);
    if (hour !== wake) continue; // so no horario que o user acorda
    await materializeRoutine(admin, uid, today);

    const [{ data: allTasks }, { data: sessions }] = await Promise.all([
      admin.from("tasks").select("date, done, dismissed, required_pomodoros, pomodoros_done").eq("user_id", uid),
      admin.from("study_sessions").select("date, type").eq("user_id", uid).eq("type", "focus"),
    ]);
    const active = (allTasks ?? []).filter((t: { dismissed?: boolean }) => !t.dismissed);
    const taskCount = active.filter((t: { date?: string; done?: boolean }) => t.date === today && !t.done).length;
    const focus: Record<string, number> = {};
    for (const s of sessions ?? []) if (s.date) focus[s.date] = (focus[s.date] || 0) + 1;
    const streak = streakOf(active, focus, today);

    const { data: exams } = await admin
      .from("exams").select("name, date, subjects(name)").eq("user_id", uid);
    const reviewsToday: string[] = [];
    let examSoon: { name: string; d: number } | null = null;
    for (const e of exams ?? []) {
      const subj = (e as { subjects?: { name?: string } }).subjects?.name || e.name;
      const d = daysBetween(e.date, today);
      if (d >= 0 && d <= 5 && (!examSoon || d < examSoon.d)) examSoon = { name: subj, d };
      for (const off of REVIEW_OFFSETS) {
        if (addDays(e.date, off) === today) reviewsToday.push(subj);
      }
    }

    const parts: string[] = [];
    if (taskCount > 0) parts.push(`${taskCount} tarefa${taskCount > 1 ? "s" : ""} hoje`);
    if (reviewsToday.length) parts.push(`revisar ${[...new Set(reviewsToday)].join(", ")}`);
    if (examSoon) parts.push(`prova de ${examSoon.name} ${examSoon.d === 0 ? "hoje" : `em ${examSoon.d}d`}`);
    if (!parts.length) continue; // nothing to say → no ping

    const body = parts.join(" · ") + (streak > 0 ? ` · 🔥 ${streak}d` : "");
    const res = await deliver(admin, [uid], {
      title: "Bom dia!", body, url: "/", tag: "digest",
    });
    delivered += res.sent;
  }
  return { job: "digest", delivered };
}

// Timed reminders: tasks with a time that are due within ~15 min.
async function runTimed(admin: Admin) {
  const { date: today, minutes: nowMin } = nowLocal();
  const hour = Math.floor(nowMin / 60);
  const { data: tasks } = await admin
    .from("tasks").select("id, user_id, title, time, category, subject_id")
    .eq("date", today).eq("done", false).is("reminded_at", null).not("time", "is", null);
  const prefsCache: Record<string, { wake: number; sleep: number }> = {};
  let delivered = 0;
  for (const t of tasks ?? []) {
    if (!t.time) continue;
    const diff = parseHHMM(t.time) - nowMin;
    // Aula avisa com 1h de antecedencia: da tempo de sair de casa. O resto
    // avisa com 15min, que e o suficiente pra trocar de contexto.
    const lead = t.category === "aula" ? 60 : 15;
    if (diff > lead || diff < -2) continue;
    if (!prefsCache[t.user_id]) { const p = await sleepPrefs(admin, t.user_id); prefsCache[t.user_id] = { wake: p.wake, sleep: p.sleep }; }
    const { wake, sleep } = prefsCache[t.user_id];
    if (!(hour >= wake && hour < sleep)) continue; // silencio durante o sono
    const res = await deliver(admin, [t.user_id], t.category === "aula"
      ? { title: `${t.title} as ${t.time}`, body: `Comeca em ${diff} min. Hora de sair.`, url: "/", tag: `task-${t.id}` }
      : { title: `Em breve: ${t.title}`, body: `${t.time}${t.category ? " · " + t.category : ""}`, url: "/", tag: `task-${t.id}` });
    await admin.from("tasks").update({ reminded_at: new Date().toISOString() }).eq("id", t.id);
    delivered += res.sent;
  }
  return { job: "timed", delivered };
}

// 30 min depois da aula terminar, pergunta se ele foi — mas so se ele ainda
// nao marcou. A notificacao abre o app ja apontando pra materia, e as duas
// respostas ficam a um toque em AulasHoje.
async function runPresenca(admin: Admin) {
  const { date: today, minutes: nowMin } = nowLocal();
  const { data: tarefas } = await admin
    .from("tasks").select("id, user_id, title, time, subject_id")
    .eq("date", today).eq("category", "aula").not("subject_id", "is", null).not("time", "is", null);
  let delivered = 0;
  for (const t of tarefas ?? []) {
    const fim = parseHHMM(t.time!) + 120;          // duracao padrao de 2 horas-aula
    const desde = nowMin - (fim + 30);
    if (desde < 0 || desde > 15) continue;          // janela de 15min apos o gatilho
    const { data: ja } = await admin.from("attendance")
      .select("id").eq("user_id", t.user_id).eq("subject_id", t.subject_id).eq("date", today).maybeSingle();
    if (ja) continue;                               // ja respondeu, nao insiste
    const res = await deliver(admin, [t.user_id], {
      title: `Voce foi na ${t.title.replace(/^Aula: /, "").split(" · ")[0]}?`,
      body: "Toque pra marcar presenca ou falta. Aula nao marcada nao entra na conta dos 75%.",
      url: `/?presenca=${t.subject_id}`,
      tag: `presenca-${t.subject_id}-${today}`,
    });
    delivered += res.sent;
  }
  return { job: "presenca", delivered };
}

// Hourly water reminder — only while awake (between the user's wake and sleep
// hours) and only if the daily goal isn't met yet. Uses tag "water" so it
// replaces the previous nudge instead of stacking.
async function runWater(admin: Admin) {
  const { date, minutes } = nowLocal();
  const hour = Math.floor(minutes / 60);
  const users = await subscribedUserIds(admin);
  let delivered = 0;
  for (const uid of users) {
    const { wake, sleep, goal, size } = await sleepPrefs(admin, uid);
    if (!(hour > wake && hour < sleep)) continue; // so acordado, e o bom dia ja cobre a hora de acordar
    const { data: wl } = await admin.from("water_logs").select("bottles").eq("user_id", uid).eq("date", date).maybeSingle();
    const bottles = (wl as { bottles?: number } | null)?.bottles || 0;
    if (goal && bottles * size >= goal) continue; // meta batida → nao enche o saco
    const res = await deliver(admin, [uid], {
      title: "Hora de beber agua 💧",
      body: goal ? `${Math.round(bottles * size)} / ${goal} ml hoje. Bora mais um gole.` : "Bora um gole de agua.",
      url: "/", tag: "water",
    });
    delivered += res.sent;
  }
  return { job: "water", delivered };
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
      return json(await deliver(admin, [user.id], {
        title: "Organizador", body: "Notificacao de teste chegou! Tudo certo por aqui.", url: "/", tag: "test",
      }));
    }

    if (body.cron && CRON_SECRET && body.cron === CRON_SECRET) {
      if (body.job === "digest") return json(await runDigest(admin));
      if (body.job === "timed") return json(await runTimed(admin));
      if (body.job === "water") return json(await runWater(admin));
      if (body.job === "presenca") return json(await runPresenca(admin));
      return json({ error: "unknown job" }, 400);
    }

    return json({ error: "nothing to do" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
