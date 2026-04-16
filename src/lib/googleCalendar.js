// ==========================================================================
// Google Calendar integration via Google Identity Services (GIS)
// OAuth 2.0 client-side flow — no backend required
// ==========================================================================
import { supabase } from './supabase';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
].join(' ');
const CALENDAR_NAME = 'Organizador';
const TIMEZONE = 'America/Sao_Paulo';

let gisReady = false;
let tokenClient = null;
let cachedToken = null;
let tokenExpiresAt = 0;
// When true, ensureToken() will NOT fall back to the consent popup if the silent
// flow fails — it will throw instead. Used by auto-sync / polling so nothing
// ever pops up without an explicit user click.
let silentModeDepth = 0;

export async function withSilentAuth(fn) {
  silentModeDepth++;
  try { return await fn(); }
  finally { silentModeDepth--; }
}

// ---- GIS Bootstrap ------------------------------------------------------
export function loadGIS() {
  return new Promise((resolve, reject) => {
    if (gisReady) return resolve();
    if (document.getElementById('google-gis-script')) {
      const check = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(check);
          gisReady = true;
          resolve();
        }
      }, 50);
      setTimeout(() => { clearInterval(check); reject(new Error('GIS load timeout')); }, 10000);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisReady = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

function isTokenValid() {
  return cachedToken && Date.now() < tokenExpiresAt - 30000; // 30s safety margin
}

// ---- Token acquisition --------------------------------------------------
export async function requestToken(prompt = '') {
  await loadGIS();
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID missing');

  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      prompt, // '' for silent, 'consent' for force consent
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        cachedToken = response.access_token;
        tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000;
        resolve(cachedToken);
      },
      error_callback: (err) => reject(new Error(err?.message || 'OAuth error')),
    });
    tokenClient.requestAccessToken({ prompt });
  });
}

export async function ensureToken({ silent = false } = {}) {
  if (isTokenValid()) return cachedToken;
  // Silent mode (explicitly requested OR inside a withSilentAuth() block):
  // NEVER touch GIS. Even prompt:'' can open a popup when the user has not
  // granted this client+scopes yet, so we only succeed if we already have a
  // cached token from a prior interactive grant. Otherwise throw so the
  // caller's catch silences this auto-sync run.
  if (silent || silentModeDepth > 0) {
    throw new Error('No cached token (silent mode)');
  }
  // Interactive mode: try silent first, fallback to consent popup
  try {
    return await requestToken('');
  } catch {
    return await requestToken('consent');
  }
}

export function clearToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

// ---- Calendar API helpers ------------------------------------------------
// Uses the silentModeDepth flag set by withSilentAuth() to forbid interactive
// OAuth popups when called from polling / auto-sync paths.
async function apiFetch(path, init = {}) {
  const token = await ensureToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Calendar API ${res.status}: ${err}`);
  }
  if (res.status === 204 || res.status === 404) return null;
  return res.json();
}

// List all calendars the user has access to
export async function listCalendars() {
  const list = await apiFetch('/users/me/calendarList');
  return (list?.items || []).map(c => ({
    id: c.id,
    summary: c.summary,
    description: c.description,
    primary: !!c.primary,
    accessRole: c.accessRole,
    backgroundColor: c.backgroundColor,
  }));
}

// List events from a calendar between two dates (RFC3339)
export async function listEvents(calendarId, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin, timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const data = await apiFetch(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  return data?.items || [];
}

export async function findOrCreateCalendar() {
  const list = await apiFetch('/users/me/calendarList');
  const existing = list?.items?.find(c => c.summary === CALENDAR_NAME);
  if (existing) return existing.id;
  const created = await apiFetch('/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: CALENDAR_NAME,
      description: 'Eventos do seu Organizador — provas, estudos, tarefas',
      timeZone: TIMEZONE,
    }),
  });
  // Make it colored (indigo-ish)
  try {
    await apiFetch(`/users/me/calendarList/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ colorId: '9' }), // blueberry
    });
  } catch {}
  return created.id;
}

function toRFC3339Date(dateStr, time = '09:00') {
  // dateStr like '2026-04-20', time '14:30' → local ISO
  const [h, m] = time.split(':').map(Number);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// ---- Event builders ------------------------------------------------------
export function buildTaskEvent(task) {
  // Only sync tasks that have a time
  if (!task.time || !task.date) return null;
  const start = toRFC3339Date(task.date, task.time);
  const end = new Date(new Date(start).getTime() + (parseInt(task.effort || '30')) * 60000).toISOString();
  return {
    summary: task.title,
    description: `Categoria: ${task.category}\nEsforço: ${task.effort}min`,
    start: { dateTime: start, timeZone: TIMEZONE },
    end: { dateTime: end, timeZone: TIMEZONE },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 10 },
        { method: 'popup', minutes: 0 },
      ],
    },
    extendedProperties: { private: { orgType: 'task', orgId: task.id } },
  };
}

export function buildExamEvent(exam, subjectName) {
  if (!exam.date) return null;
  return {
    summary: `Prova: ${subjectName} — ${exam.name}`,
    description: `Prova de ${subjectName}`,
    start: { date: exam.date },
    end: { date: exam.date },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 }, // 1 dia antes
        { method: 'popup', minutes: 60 },       // 1h antes
        { method: 'popup', minutes: 15 },       // 15 min antes
      ],
    },
    extendedProperties: { private: { orgType: 'exam', orgId: exam.id } },
  };
}

export function buildReviewEvent(reviewDate, subjectName, subjectId) {
  return {
    summary: `Revisar: ${subjectName}`,
    description: 'Revisao espacada (metodo 2357) — feche o material e tente lembrar',
    start: { dateTime: toRFC3339Date(reviewDate, '19:00'), timeZone: TIMEZONE },
    end: { dateTime: toRFC3339Date(reviewDate, '20:00'), timeZone: TIMEZONE },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 30 }],
    },
    extendedProperties: { private: { orgType: 'review', orgId: `${subjectId}-${reviewDate}` } },
  };
}

// ---- Event upsert/delete -------------------------------------------------
export async function upsertEvent(calendarId, event, existingGoogleEventId = null) {
  if (existingGoogleEventId) {
    const result = await apiFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${existingGoogleEventId}`, {
      method: 'PUT',
      body: JSON.stringify(event),
    });
    if (result) return result;
    // 404 — fallthrough to create
  }
  const created = await apiFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
  return created;
}

export async function deleteEvent(calendarId, googleEventId) {
  if (!googleEventId) return;
  try {
    await apiFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`, {
      method: 'DELETE',
    });
  } catch (e) {
    // Ignore if already deleted
    console.warn('Delete event failed:', e.message);
  }
}

// ---- Build map of existing org events in the remote calendar ------------
// Scans events in a ±1y window, groups them by extendedProperties.private.orgId
// and by (summary + start) as a fallback, keeps the first in each group, and
// deletes the rest. This is our safety net against state/DB losing
// google_event_id pointers — instead of blindly creating a new event, syncAll
// reconciles with what already exists in the calendar.
//
// Returns { orgMap, duplicates } where duplicates is the list of event ids
// that should be deleted. When awaitDeletes is true the caller waits for
// the deletes to complete (used by the explicit cleanup button); syncAll
// uses fire-and-forget to keep the sync snappy.
async function buildOrgIdMapAndCleanup(calendarId, { awaitDeletes = false } = {}) {
  const now = Date.now();
  const timeMin = new Date(now - 365 * 86400000).toISOString();
  const timeMax = new Date(now + 365 * 86400000).toISOString();
  const map = new Map();
  const seenByFingerprint = new Map(); // summary+start -> eventId
  const duplicates = []; // [{ eventId, orgId, reason }]
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      timeMin, timeMax, singleEvents: 'true', maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await apiFetch(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    for (const ev of data?.items || []) {
      const orgId = ev.extendedProperties?.private?.orgId;
      // Primary dedup: by orgId (every event we create has one)
      if (orgId) {
        if (map.has(orgId)) { duplicates.push({ eventId: ev.id, orgId, reason: 'orgId' }); continue; }
        map.set(orgId, ev.id);
      }
      // Secondary dedup: same summary + start. Catches legacy events that
      // somehow lost their orgId, or duplicates imported from an older sync.
      const start = ev.start?.dateTime || ev.start?.date;
      if (ev.summary && start) {
        const fp = `${ev.summary}|${start}`;
        if (seenByFingerprint.has(fp)) {
          duplicates.push({ eventId: ev.id, orgId: orgId || null, reason: 'fingerprint' });
        } else {
          seenByFingerprint.set(fp, ev.id);
        }
      }
    }
    pageToken = data?.nextPageToken || null;
  } while (pageToken);

  if (awaitDeletes) {
    // Standalone cleanup: wait so the caller can report a real count to the UI
    for (const d of duplicates) {
      try { await deleteEvent(calendarId, d.eventId); } catch {}
    }
  } else if (duplicates.length > 0) {
    // Called from syncAll: fire-and-forget — don't block the sync on deletes
    console.warn(`Cleaning up ${duplicates.length} duplicate calendar event(s)`);
    for (const d of duplicates) {
      deleteEvent(calendarId, d.eventId).catch(() => {});
    }
  }

  return { map, deletedCount: duplicates.length };
}

// Standalone: scan the calendar and delete every duplicate event we find,
// without creating/updating anything. Used by the "Limpar duplicatas" button.
export async function cleanupCalendarDuplicates(calendarId) {
  const { deletedCount } = await buildOrgIdMapAndCleanup(calendarId, { awaitDeletes: true });
  return deletedCount;
}

// ---- Full sync of all events --------------------------------------------
export async function syncAll(state, calendarId, userId) {
  let syncedCount = 0;

  // Reconcile against what's already in the remote calendar to avoid creating
  // duplicates when state/DB lost the google_event_id pointer.
  let orgMap = new Map();
  try {
    const { map } = await buildOrgIdMapAndCleanup(calendarId);
    orgMap = map;
  } catch (e) {
    console.warn('Could not build orgId map, proceeding without dedup:', e.message);
  }

  // Tasks with time — only sync MANUAL, not-done tasks to the calendar.
  // - Done tasks: user wants "done" to stay purely local.
  // - Imported tasks (classroom / work_calendar / moodle / class): the source
  //   calendar already owns them, we don't mirror back.
  for (const task of state.tasks || []) {
    if (!task.time) continue;
    if (task.done) continue;
    if (task.source && task.source !== 'manual') continue;
    const event = buildTaskEvent(task);
    if (!event) continue;
    const existingId = task.google_event_id || orgMap.get(task.id);
    try {
      const result = await upsertEvent(calendarId, event, existingId);
      if (result?.id && result.id !== task.google_event_id) {
        await supabase.from('tasks').update({ google_event_id: result.id }).eq('id', task.id);
      }
      syncedCount++;
    } catch (e) {
      console.error('Task sync failed:', task.id, e);
    }
  }

  // Exams (each subject)
  for (const subject of state.subjects || []) {
    for (const exam of subject.exams || []) {
      const event = buildExamEvent(exam, subject.name);
      if (!event) continue;
      const existingId = exam.google_event_id || orgMap.get(exam.id);
      try {
        const result = await upsertEvent(calendarId, event, existingId);
        if (result?.id && result.id !== exam.google_event_id) {
          await supabase.from('exams').update({ google_event_id: result.id }).eq('id', exam.id);
        }
        syncedCount++;
      } catch (e) {
        console.error('Exam sync failed:', exam.id, e);
      }
    }
  }

  // Update last_synced_at
  await supabase.from('profiles').update({
    google_last_synced_at: new Date().toISOString(),
  }).eq('id', userId);

  return syncedCount;
}

// ---- Disconnect ---------------------------------------------------------
export async function disconnect(userId) {
  clearToken();
  // Revoke the token on Google
  if (cachedToken) {
    try {
      window.google?.accounts?.oauth2?.revoke(cachedToken, () => {});
    } catch {}
  }
  await supabase.from('profiles').update({
    google_calendar_id: null,
    google_connected_at: null,
    google_last_synced_at: null,
  }).eq('id', userId);
}
