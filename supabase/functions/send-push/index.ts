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

// Ensure today's home-routine items exist as casa tasks (same as the client
// does on open — but server-side, so the board is ready each morning).
async function materializeRoutine(admin: Admin, userId: string, today: string) {
  const dow = weekday(today);
  const [{ data: routine }, { data: custom }, { data: existing }] = await Promise.all([
    admin.from("home_routine").select("room_key, days").eq("user_id", userId),
    admin.from("custom_rooms").select("key, label").eq("user_id", userId),
    admin.from("tasks").select("title").eq("user_id", userId).eq("date", today).eq("category", "casa"),
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
    rows.push({ user_id: userId, title, category: "casa", effort: "30", time: null, done: false, date: today, recurring: true });
  }
  if (rows.length) await admin.from("tasks").insert(rows);
}

// Morning digest: materialize routine, then summarize today for each user.
async function runDigest(admin: Admin) {
  const { date: today } = nowLocal();
  const users = await subscribedUserIds(admin);
  let delivered = 0;
  for (const uid of users) {
    await materializeRoutine(admin, uid, today);

    const { data: tasks } = await admin
      .from("tasks").select("title").eq("user_id", uid).eq("date", today)
      .eq("done", false).or("dismissed.is.null,dismissed.eq.false");
    const taskCount = (tasks ?? []).length;

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

    const res = await deliver(admin, [uid], {
      title: "Bom dia!", body: parts.join(" · "), url: "/", tag: "digest",
    });
    delivered += res.sent;
  }
  return { job: "digest", delivered };
}

// Timed reminders: tasks with a time that are due within ~15 min.
async function runTimed(admin: Admin) {
  const { date: today, minutes: nowMin } = nowLocal();
  const { data: tasks } = await admin
    .from("tasks").select("id, user_id, title, time, category")
    .eq("date", today).eq("done", false).is("reminded_at", null).not("time", "is", null);
  let delivered = 0;
  for (const t of tasks ?? []) {
    if (!t.time) continue;
    const diff = parseHHMM(t.time) - nowMin;
    if (diff > 15 || diff < -2) continue; // only within the 15-min lead window
    const res = await deliver(admin, [t.user_id], {
      title: `Em breve: ${t.title}`, body: `${t.time}${t.category ? " · " + t.category : ""}`, url: "/", tag: `task-${t.id}`,
    });
    await admin.from("tasks").update({ reminded_at: new Date().toISOString() }).eq("id", t.id);
    delivered += res.sent;
  }
  return { job: "timed", delivered };
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
      return json({ error: "unknown job" }, 400);
    }

    return json({ error: "nothing to do" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
