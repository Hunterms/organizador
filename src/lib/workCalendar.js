// ==========================================================================
// Import events from external Google Calendars as tasks (com checkbox)
// Reusa o OAuth do Google ja autenticado
// ==========================================================================
import { supabase } from './supabase';
import { listCalendars, listEvents } from './googleCalendar';

// ---- Profile management --------------------------------------------------
export async function getWorkCalendarConfig(userId) {
  const { data } = await supabase.from('profiles')
    .select('work_calendar_ids, work_last_synced_at')
    .eq('id', userId).single();
  return {
    calendarIds: data?.work_calendar_ids || [],
    lastSyncedAt: data?.work_last_synced_at,
  };
}

export async function saveWorkCalendarIds(userId, ids) {
  const { error } = await supabase.from('profiles')
    .update({ work_calendar_ids: ids })
    .eq('id', userId);
  if (error) throw error;
}

// ---- Event → Task mapper -------------------------------------------------
function gEventToTask(ev, userId) {
  // Skip cancelled events
  if (ev.status === 'cancelled') return null;
  // Skip events without start
  if (!ev.start) return null;

  const isAllDay = !!ev.start.date;
  const startDate = isAllDay ? ev.start.date : ev.start.dateTime?.split('T')[0];
  let time = null;
  if (!isAllDay && ev.start.dateTime) {
    const d = new Date(ev.start.dateTime);
    time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // Estimate effort from duration
  let effort = '60';
  if (ev.start.dateTime && ev.end?.dateTime) {
    const minutes = (new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / 60000;
    effort = minutes <= 30 ? '30' : minutes <= 90 ? '60' : '120';
  }

  return {
    user_id: userId,
    title: (ev.summary || 'Evento').slice(0, 200),
    category: 'trabalho',
    effort,
    time,
    date: startDate,
    done: false,
    recurring: false,
    source: 'work_calendar',
    classroom_coursework_id: ev.id, // reuse field as external event ID
  };
}

// ---- Import events as tasks ----------------------------------------------
export async function importWorkEvents(userId) {
  const summary = { newTasks: 0, updatedTasks: 0, removedTasks: 0, errors: [] };

  const { calendarIds } = await getWorkCalendarConfig(userId);
  if (!calendarIds || calendarIds.length === 0) {
    return summary;
  }

  // Time range: today to +14 days
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const future = new Date(now);
  future.setDate(future.getDate() + 14);
  const timeMin = now.toISOString();
  const timeMax = future.toISOString();

  // Existing work tasks (for dedup + cleanup). Include dismissed so we don't
  // re-create tasks the user deleted locally.
  const { data: existingTasks } = await supabase.from('tasks')
    .select('id, classroom_coursework_id, date, time, title, done, dismissed')
    .eq('user_id', userId)
    .eq('source', 'work_calendar');
  const existingByExtId = new Map();
  for (const t of existingTasks || []) {
    if (t.classroom_coursework_id) existingByExtId.set(t.classroom_coursework_id, t);
  }

  const seenExtIds = new Set();

  for (const calId of calendarIds) {
    let events;
    try {
      events = await listEvents(calId, timeMin, timeMax);
    } catch (e) {
      summary.errors.push(`${calId}: ${e.message}`);
      continue;
    }

    for (const ev of events) {
      const task = gEventToTask(ev, userId);
      if (!task) continue;
      seenExtIds.add(task.classroom_coursework_id);

      const existing = existingByExtId.get(task.classroom_coursework_id);
      if (existing) {
        // User dismissed this one locally — leave it alone.
        if (existing.dismissed) continue;
        // Update if title/date/time changed (and not done)
        if (!existing.done && (existing.title !== task.title || existing.date !== task.date || existing.time !== task.time)) {
          await supabase.from('tasks').update({
            title: task.title, date: task.date, time: task.time,
          }).eq('id', existing.id);
          summary.updatedTasks++;
        }
      } else {
        const { error } = await supabase.from('tasks').insert(task);
        if (error) summary.errors.push(`Insert: ${error.message}`);
        else summary.newTasks++;
      }
    }
  }

  // Remove past events that no longer exist (cancelled in source calendar).
  // Skip dismissed tasks — they're already soft-deleted for the UI.
  for (const [extId, t] of existingByExtId) {
    if (!seenExtIds.has(extId) && !t.done && !t.dismissed && new Date(t.date) >= now) {
      await supabase.from('tasks').delete().eq('id', t.id);
      summary.removedTasks++;
    }
  }

  await supabase.from('profiles')
    .update({ work_last_synced_at: new Date().toISOString() })
    .eq('id', userId);

  return summary;
}

// ---- List available calendars (cached for UI) ----------------------------
export { listCalendars };
