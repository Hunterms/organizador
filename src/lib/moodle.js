// ==========================================================================
// Moodle Unicamp — iCal fetch + parse + import
// Usa Supabase Edge Function 'fetch-ical' como proxy CORS
// ==========================================================================
import { supabase } from './supabase';

// ---- iCal parser (mini, ja que so precisamos VEVENT) ---------------------
function unfold(ics) {
  // RFC 5545: lines beginning with whitespace are continuations
  return ics.replace(/\r?\n[ \t]/g, '');
}

function parseICalDate(value) {
  // Formats: 20260420 (date), 20260420T140000Z (datetime UTC), 20260420T140000 (local)
  const v = value.replace(/[^0-9TZ]/g, '');
  if (v.length === 8) {
    // All-day
    return { date: `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`, allDay: true };
  }
  if (v.length >= 15) {
    const y = v.slice(0,4), mo = v.slice(4,6), d = v.slice(6,8);
    const h = v.slice(9,11), mi = v.slice(11,13), s = v.slice(13,15) || '00';
    const isUTC = v.endsWith('Z');
    const date = isUTC
      ? new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`)
      : new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
    // Use local date parts — toISOString() would flip the day near midnight UTC.
    const ly = date.getFullYear();
    const lm = String(date.getMonth() + 1).padStart(2, '0');
    const ld = String(date.getDate()).padStart(2, '0');
    const dateStr = `${ly}-${lm}-${ld}`;
    const timeStr = date.toTimeString().slice(0, 5);
    return { date: dateStr, time: timeStr, allDay: false };
  }
  return null;
}

export function parseICS(ics) {
  const lines = unfold(ics).split(/\r?\n/);
  const events = [];
  let current = null;

  for (const raw of lines) {
    if (raw === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (raw === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = raw.indexOf(':');
    if (colon < 0) continue;
    const keyPart = raw.slice(0, colon);
    const value = raw.slice(colon + 1);
    const key = keyPart.split(';')[0];

    switch (key) {
      case 'UID': current.uid = value; break;
      case 'SUMMARY': current.summary = value.replace(/\\n/g, ' ').replace(/\\,/g, ','); break;
      case 'DESCRIPTION': current.description = value.replace(/\\n/g, ' ').replace(/\\,/g, ','); break;
      case 'DTSTART': current.start = parseICalDate(value); break;
      case 'DTEND': current.end = parseICalDate(value); break;
      case 'CATEGORIES': current.categories = value.split(','); break;
      case 'URL': current.url = value; break;
      case 'LOCATION': current.location = value; break;
    }
  }
  return events;
}

// ---- Fetch via Edge Function -----------------------------------------------
async function fetchMoodleIcs(url) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-ical`;
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Edge function failed: ${res.status} ${errText}`);
  }
  return res.text();
}

// ---- Save URL to profile ---------------------------------------------------
export async function saveMoodleUrl(userId, url) {
  const { error } = await supabase.from('profiles').update({
    moodle_ical_url: url,
  }).eq('id', userId);
  if (error) throw error;
}

export async function getMoodleUrl(userId) {
  const { data } = await supabase.from('profiles').select('moodle_ical_url, moodle_last_synced_at').eq('id', userId).single();
  return data || {};
}

// ---- Import events from Moodle ---------------------------------------------
function inferCategory(summary, categories = []) {
  const s = (summary || '').toLowerCase();
  const cats = (categories || []).join(' ').toLowerCase();
  if (/prova|exam|avaliacao|p[12345]\b/.test(s)) return 'exam';
  if (/entrega|deadline|prazo|atividade|trabalho|projeto/.test(s)) return 'task';
  return 'task';
}

function extractCourseName(summary, description) {
  // Moodle Unicamp summary format: "Course code (Course name)" or "Atividade — Curso"
  // Try description first
  if (description) {
    const m = description.match(/Curso:\s*([^\n]+)/i);
    if (m) return m[1].trim();
  }
  // Fallback: parse from summary
  const m = summary?.match(/\(([^)]+)\)/);
  if (m) return m[1].trim();
  return summary?.split(/[—-]/)?.[0]?.trim() || 'Moodle';
}

function normalize(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function importFromMoodle(userId, currentState) {
  const summary = { newSubjects: 0, newTasks: 0, newExams: 0, errors: [] };

  const { moodle_ical_url } = await getMoodleUrl(userId);
  if (!moodle_ical_url) {
    summary.errors.push('URL do Moodle nao configurada');
    return summary;
  }

  let ics;
  try {
    ics = await fetchMoodleIcs(moodle_ical_url);
  } catch (e) {
    summary.errors.push(e.message);
    return summary;
  }

  const events = parseICS(ics);

  // Existing subjects (for matching by name).
  // Include dismissed so we dedup against user-removed subjects too.
  const subjectByName = new Map();
  const subjectByMoodleId = new Map();

  const { data: dbSubjects } = await supabase.from('subjects')
    .select('id, name, moodle_course_id, dismissed').eq('user_id', userId);
  for (const s of dbSubjects || []) {
    subjectByName.set(normalize(s.name), s);
    if (s.moodle_course_id) subjectByMoodleId.set(s.moodle_course_id, s);
  }

  // Existing tasks/exams (dedup via UID stored as classroom_coursework_id reused).
  // Include dismissed so we never re-import items the user deleted locally.
  const { data: dbTasks } = await supabase.from('tasks')
    .select('id, classroom_coursework_id, date, time, dismissed')
    .eq('user_id', userId)
    .eq('source', 'moodle');
  const taskByUid = new Map();
  for (const t of dbTasks || []) {
    if (t.classroom_coursework_id) taskByUid.set(t.classroom_coursework_id, t);
  }

  const { data: dbExams } = await supabase.from('exams')
    .select('id, classroom_coursework_id, date')
    .eq('user_id', userId)
    .eq('source', 'moodle');
  const examByUid = new Map();
  for (const e of dbExams || []) {
    if (e.classroom_coursework_id) examByUid.set(e.classroom_coursework_id, e);
  }

  for (const ev of events) {
    if (!ev.start) continue;
    const courseName = extractCourseName(ev.summary, ev.description);
    let subject = subjectByName.get(normalize(courseName));

    // User dismissed this subject — skip the event entirely, don't create
    // exams/tasks under a course they removed.
    if (subject?.dismissed) continue;

    if (!subject) {
      const { data, error } = await supabase.from('subjects').insert({
        user_id: userId,
        name: courseName,
      }).select().single();
      if (error) { summary.errors.push(`Subject ${courseName}: ${error.message}`); continue; }
      subject = data;
      subjectByName.set(normalize(courseName), subject);
      summary.newSubjects++;
    }

    const kind = inferCategory(ev.summary, ev.categories);
    if (kind === 'exam') {
      if (examByUid.has(ev.uid)) continue; // skip duplicate (or already-dismissed)
      const { error } = await supabase.from('exams').insert({
        user_id: userId,
        subject_id: subject.id,
        name: ev.summary?.slice(0, 200) || 'Prova',
        date: ev.start.date,
        source: 'moodle',
        classroom_coursework_id: ev.uid, // reuse field for dedup
      });
      if (error) { summary.errors.push(`Exam: ${error.message}`); continue; }
      summary.newExams++;
    } else {
      // taskByUid.has covers both active and dismissed tasks — either way we
      // never re-create.
      if (taskByUid.has(ev.uid)) continue;
      const { error } = await supabase.from('tasks').insert({
        user_id: userId,
        title: ev.summary?.slice(0, 200) || 'Atividade Moodle',
        category: 'estudos',
        effort: '60',
        time: ev.start.time || null,
        date: ev.start.date,
        done: false,
        recurring: false,
        source: 'moodle',
        classroom_coursework_id: ev.uid,
      });
      if (error) { summary.errors.push(`Task: ${error.message}`); continue; }
      summary.newTasks++;
    }
  }

  await supabase.from('profiles').update({
    moodle_last_synced_at: new Date().toISOString(),
  }).eq('id', userId);

  return summary;
}
