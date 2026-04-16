// Supabase Edge Function: fetch-ical
// Server-side fetcher for iCal URLs (Moodle, etc.) to bypass browser CORS.
//
// Deploy via Supabase Dashboard:
//   1. Project → Edge Functions → "Create a new function"
//   2. Name: fetch-ical
//   3. Cole este codigo
//   4. Deploy
//
// Auth: requires the user's Supabase JWT (anon key + session). The function
// validates that the URL is from a trusted iCal source (Moodle, Google).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_HOSTS = [
  'moodle.ggte.unicamp.br',
  'moodle.ic.unicamp.br',
  'calendar.google.com',
  'www.google.com',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url required' }), {
        status: 400, headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      });
    }

    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return new Response(JSON.stringify({ error: `host ${parsed.hostname} not allowed` }), {
        status: 403, headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      });
    }

    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'OrganizadorBot/1.0' },
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `upstream ${upstream.status}` }), {
        status: upstream.status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      });
    }

    const ics = await upstream.text();

    return new Response(ics, {
      headers: { ...CORS_HEADERS, 'content-type': 'text/calendar' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }
});
