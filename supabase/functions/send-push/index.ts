// Supabase Edge Function: send-push
// Sends Web Push notifications via VAPID.
//
// Modes:
//   { test: true }          → caller (from JWT) gets a test notification.
//   { cron: "<CRON_SECRET>" } → scheduled reminders for all users (Fase 2).
//
// Secrets required (Project → Edge Functions → Secrets):
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

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

// Deliver one payload to every subscription of the given users. Cleans up
// subscriptions the push service reports as gone (404/410).
async function deliver(admin: ReturnType<typeof createClient>, userIds: string[], payload: unknown) {
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);
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
      } else {
        console.error("push send failed:", code, String(e));
      }
    }
  }
  return { sent, removed };
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
      const res = await deliver(admin, [user.id], {
        title: "Organizador",
        body: "Notificacao de teste chegou! Tudo certo por aqui.",
        url: "/",
        tag: "test",
      });
      return json(res);
    }

    // Fase 2: scheduled reminders. Guarded by a shared secret so pg_cron can
    // call it without a user JWT.
    if (body.cron && CRON_SECRET && body.cron === CRON_SECRET) {
      // TODO(Fase 2): query due routine/tasks/exams and deliver per user.
      return json({ ok: true, note: "cron path not implemented yet" });
    }

    return json({ error: "nothing to do" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
