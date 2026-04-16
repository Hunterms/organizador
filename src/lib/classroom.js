// ==========================================================================
// Google Classroom API integration
// Reusa o mesmo OAuth do Calendar (scopes ja incluem classroom)
// ==========================================================================
import { supabase } from './supabase';
import { ensureToken } from './googleCalendar';

const API = 'https://classroom.googleapis.com/v1';

async function gFetch(path, init = {}) {
  const token = await ensureToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Classroom API ${res.status}: ${err}`);
  }
  return res.json();
}

// ---- API wrappers --------------------------------------------------------
export async function listCourses() {
  const data = await gFetch('/courses?courseStates=ACTIVE');
  return data.courses || [];
}

export async function listCoursework(courseId) {
  try {
    const data = await gFetch(`/courses/${courseId}/courseWork?orderBy=dueDate`);
    return data.courseWork || [];
  } catch (e) {
    // Some courses may not have coursework or user lacks permission
    return [];
  }
}

// ---- Mappers -------------------------------------------------------------
function dueDateToString(dueDate, dueTime) {
  if (!dueDate) return null;
  const y = dueDate.year;
  const m = String(dueDate.month).padStart(2, '0');
  const d = String(dueDate.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dueTimeToString(dueTime) {
  if (!dueTime) return '';
  const h = String(dueTime.hours || 0).padStart(2, '0');
  const m = String(dueTime.minutes || 0).padStart(2, '0');
  return `${h}:${m}`;
}

function normalizeName(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// ---- Importer ------------------------------------------------------------
export async function importFromClassroom(userId, currentState) {
  const summary = { newSubjects: 0, newTasks: 0, updatedTasks: 0, errors: [] };

  let courses;
  try {
    courses = await listCourses();
  } catch (e) {
    summary.errors.push(`Falha ao listar cursos: ${e.message}`);
    return summary;
  }

  // 1) Map courses → subjects
  // Match by classroom_course_id first, then by name
  const existingSubjects = currentState.subjects || [];
  const subjectByClassroomId = new Map();
  const subjectByName = new Map();

  for (const s of existingSubjects) {
    if (s.classroom_course_id) subjectByClassroomId.set(s.classroom_course_id, s);
    subjectByName.set(normalizeName(s.name), s);
  }

  // Fetch existing subjects from DB to get classroom_course_id.
  // Include dismissed ones — we want to dedup against them too so we never
  // re-create a subject the user explicitly removed (old semester courses).
  const { data: dbSubjects } = await supabase
    .from('subjects')
    .select('id, name, classroom_course_id, dismissed')
    .eq('user_id', userId);
  for (const s of dbSubjects || []) {
    if (s.classroom_course_id) subjectByClassroomId.set(s.classroom_course_id, s);
  }

  // Existing tasks (for dedup). Also include dismissed so we don't re-import
  // tasks the user deleted locally.
  const { data: dbTasks } = await supabase
    .from('tasks')
    .select('id, classroom_coursework_id, date, time, dismissed')
    .eq('user_id', userId)
    .not('classroom_coursework_id', 'is', null);
  const taskByCWID = new Map();
  for (const t of dbTasks || []) {
    if (t.classroom_coursework_id) taskByCWID.set(t.classroom_coursework_id, t);
  }

  for (const course of courses) {
    let subject = subjectByClassroomId.get(course.id);

    // If the user dismissed this subject, skip it entirely — don't re-create
    // the subject and don't import any of its coursework.
    if (subject?.dismissed) continue;

    // Try match by name
    if (!subject) {
      subject = subjectByName.get(normalizeName(course.name));
      if (subject) {
        // Link this subject to the course
        await supabase.from('subjects').update({ classroom_course_id: course.id }).eq('id', subject.id);
        subjectByClassroomId.set(course.id, subject);
      }
    }

    // Create subject if not found
    if (!subject) {
      const { data, error } = await supabase.from('subjects').insert({
        user_id: userId,
        name: course.name,
        code: course.section || null,
        classroom_course_id: course.id,
      }).select().single();
      if (error) {
        summary.errors.push(`Erro criando ${course.name}: ${error.message}`);
        continue;
      }
      subject = data;
      subjectByClassroomId.set(course.id, subject);
      summary.newSubjects++;
    }

    // 2) Fetch coursework
    const coursework = await listCoursework(course.id);
    for (const cw of coursework) {
      if (cw.state !== 'PUBLISHED') continue; // skip drafts
      const dateStr = dueDateToString(cw.dueDate);
      if (!dateStr) continue; // skip items without due date

      const existing = taskByCWID.get(cw.id);
      if (existing) {
        // User dismissed this task locally — leave it alone. Never update,
        // never re-surface.
        if (existing.dismissed) continue;
        // Update if date changed
        const newTime = dueTimeToString(cw.dueTime);
        if (existing.date !== dateStr || existing.time !== newTime) {
          await supabase.from('tasks').update({
            date: dateStr,
            time: newTime || null,
          }).eq('id', existing.id);
          summary.updatedTasks++;
        }
        continue;
      }

      // Create task
      const taskTitle = `${course.name}: ${cw.title}`;
      const { error } = await supabase.from('tasks').insert({
        user_id: userId,
        title: taskTitle.slice(0, 200),
        category: 'estudos',
        effort: cw.workType === 'ASSIGNMENT' ? '120' : '60',
        time: dueTimeToString(cw.dueTime) || null,
        date: dateStr,
        done: false,
        recurring: false,
        classroom_coursework_id: cw.id,
        source: 'classroom',
      });
      if (error) {
        summary.errors.push(`Erro criando task ${cw.title}: ${error.message}`);
      } else {
        summary.newTasks++;
      }
    }
  }

  // Update last sync timestamp
  await supabase.from('profiles').update({
    classroom_last_synced_at: new Date().toISOString(),
  }).eq('id', userId);

  return summary;
}
