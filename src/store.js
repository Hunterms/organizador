import { supabase } from './lib/supabase';

// ==========================================================================
// State shape (same as before, but hydrated from Supabase)
// ==========================================================================
const defaultState = {
  tasks: [],
  subjects: [],
  kanban: { todo: [], doing: [], done: [] },
  water: {},
  homeRoutine: {},
  customRooms: [],
  studySessions: [],
  pomodoroSettings: { focusDuration: 25, shortBreak: 5, longBreak: 15, sessionsBeforeLong: 4 },
  settings: { weight: 78, bottleSize: 700, waterGoal: 2730 },
  patterns: [],
};

const CACHE_KEY = 'organizador_cache_v2';

// Local cache for offline/fast-render
export function loadCache() {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultState, ...parsed };
    }
  } catch {}
  return defaultState;
}

export function saveCache(state) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch {}
}

// ==========================================================================
// FETCH: pega todos os dados do usuario numa chamada
// ==========================================================================
export async function fetchAllData(userId) {
  const [
    { data: profile },
    { data: tasks },
    { data: subjects },
    { data: topics },
    { data: exams },
    { data: studySessions },
    { data: waterLogs },
    { data: homeRoutine },
    { data: customRooms },
    { data: kanbanCards },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    // Fetch all; we filter dismissed out client-side below so the app still
    // works even if the dismissed-migration hasn't been run yet.
    supabase.from('tasks').select('*').eq('user_id', userId).order('position'),
    supabase.from('subjects').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('topics').select('*').eq('user_id', userId).order('position'),
    supabase.from('exams').select('*').eq('user_id', userId).order('date'),
    supabase.from('study_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('water_logs').select('*').eq('user_id', userId),
    supabase.from('home_routine').select('*').eq('user_id', userId),
    supabase.from('custom_rooms').select('*').eq('user_id', userId),
    supabase.from('kanban_cards').select('*').eq('user_id', userId).order('position'),
  ]);

  // Water as map { 'YYYY-MM-DD': bottles }
  const water = {};
  (waterLogs || []).forEach(w => { water[w.date] = w.bottles; });

  // Home routine as map { room_key: { days: [...] } }
  const routineMap = {};
  (homeRoutine || []).forEach(r => { routineMap[r.room_key] = { days: r.days }; });

  // Subjects with embedded topics + exams
  const topicsBySubject = {};
  (topics || []).forEach(t => {
    if (!topicsBySubject[t.subject_id]) topicsBySubject[t.subject_id] = [];
    topicsBySubject[t.subject_id].push({
      id: t.id,
      name: t.name,
      status: t.status,
      totalStudyMinutes: t.total_study_minutes || 0,
      lastStudied: t.last_studied,
      // Study methods: retrieval practice + spaced repetition + reflection
      confidence: t.confidence || 0,
      last_retrieval_at: t.last_retrieval_at,
      next_review_at: t.next_review_at,
      retrieval_count: t.retrieval_count || 0,
      feynman_note: t.feynman_note,
      why_difficult: t.why_difficult,
    });
  });
  const examsBySubject = {};
  (exams || []).forEach(e => {
    if (!examsBySubject[e.subject_id]) examsBySubject[e.subject_id] = [];
    examsBySubject[e.subject_id].push({
      id: e.id, name: e.name, date: e.date, google_event_id: e.google_event_id,
    });
  });

  const subjectsWithChildren = (subjects || []).filter(s => !s.dismissed).map(s => ({
    id: s.id,
    name: s.name,
    code: s.code,
    syllabus: s.syllabus,
    // classroom_course_id lets the UI know this came from Classroom import
    // and should be soft-dismissed instead of hard-deleted.
    classroom_course_id: s.classroom_course_id,
    topics: topicsBySubject[s.id] || [],
    exams: examsBySubject[s.id] || [],
    assignments: [],
  }));

  // Kanban by column
  const kanban = { todo: [], doing: [], done: [] };
  (kanbanCards || []).forEach(c => {
    if (kanban[c.column_name]) kanban[c.column_name].push({
      id: c.id, title: c.title, project: c.project,
      priority: c.priority, effort: c.effort, createdAt: c.created_at,
    });
  });

  const studySessionsFormatted = (studySessions || []).map(s => ({
    id: s.id, subjectId: s.subject_id, topicName: s.topic_name,
    duration: s.duration, date: s.date, type: s.type,
  }));

  return {
    ...defaultState,
    tasks: (tasks || []).filter(t => !t.dismissed).map(t => ({
      id: t.id, title: t.title, category: t.category, effort: t.effort,
      time: t.time || '', done: t.done, date: t.date, recurring: t.recurring || false,
      google_event_id: t.google_event_id,
      // source is needed by the UI to pick hard-delete (manual) vs soft-dismiss (imports)
      source: t.source || 'manual',
      // companion_task_id links a child task (e.g. "Pegar circular") back to
      // its parent (an "aula"). Deleting the parent cascades a cleanup.
      companion_task_id: t.companion_task_id,
    })),
    subjects: subjectsWithChildren,
    kanban,
    water,
    homeRoutine: routineMap,
    customRooms: (customRooms || []).map(r => ({ key: r.key, label: r.label, icon: r.icon, color: r.color })),
    studySessions: studySessionsFormatted,
    settings: {
      weight: profile?.weight || 78,
      bottleSize: profile?.bottle_size || 700,
      waterGoal: profile?.water_goal || 2730,
    },
    pomodoroSettings: profile?.pomodoro_settings || defaultState.pomodoroSettings,
  };
}

// ==========================================================================
// MUTATIONS: cada operacao envia pro Supabase e atualiza estado local
// ==========================================================================

// Tasks
export async function createTask(userId, task) {
  const payload = {
    user_id: userId, title: task.title, category: task.category,
    effort: task.effort, time: task.time || null, done: !!task.done,
    date: task.date, recurring: !!task.recurring,
  };
  // Companion link (e.g., circular task → aula parent). Only sent when set so
  // older schemas without the column keep working.
  if (task.companion_task_id) payload.companion_task_id = task.companion_task_id;
  const { data, error } = await supabase.from('tasks').insert(payload).select().single();
  if (error) throw error;
  return { id: data.id, ...task };
}

export async function updateTask(taskId, updates) {
  const dbUpdates = {};
  if ('title' in updates) dbUpdates.title = updates.title;
  if ('category' in updates) dbUpdates.category = updates.category;
  if ('effort' in updates) dbUpdates.effort = updates.effort;
  if ('time' in updates) dbUpdates.time = updates.time || null;
  if ('done' in updates) dbUpdates.done = updates.done;
  if ('date' in updates) dbUpdates.date = updates.date;
  if ('position' in updates) dbUpdates.position = updates.position;
  if ('companion_task_id' in updates) dbUpdates.companion_task_id = updates.companion_task_id;
  const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
  if (error) throw error;
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

// Soft-delete: used for imported tasks (classroom/moodle/work_calendar/class)
// so the next sync doesn't re-create them.
export async function dismissTask(taskId) {
  const { error } = await supabase.from('tasks').update({ dismissed: true }).eq('id', taskId);
  if (error) throw error;
}

// Subjects
export async function createSubject(userId, subject) {
  const { data, error } = await supabase.from('subjects').insert({
    user_id: userId, name: subject.name, code: subject.code || null, syllabus: subject.syllabus || null,
  }).select().single();
  if (error) throw error;
  return { id: data.id, ...subject, topics: [], exams: [], assignments: [] };
}

export async function updateSubject(subjectId, updates) {
  const dbUpdates = {};
  if ('name' in updates) dbUpdates.name = updates.name;
  if ('code' in updates) dbUpdates.code = updates.code;
  if ('syllabus' in updates) dbUpdates.syllabus = updates.syllabus;
  const { error } = await supabase.from('subjects').update(dbUpdates).eq('id', subjectId);
  if (error) throw error;
}

export async function deleteSubject(subjectId) {
  const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
  if (error) throw error;
}

// Soft-delete: used for subjects imported from Classroom so the next sync
// doesn't re-create them (old-semester courses the user is done with).
export async function dismissSubject(subjectId) {
  const { error } = await supabase.from('subjects').update({ dismissed: true }).eq('id', subjectId);
  if (error) throw error;
}

// Topics
export async function createTopic(userId, subjectId, topic) {
  const { data, error } = await supabase.from('topics').insert({
    user_id: userId, subject_id: subjectId, name: topic.name,
    status: topic.status || 'not_studied',
  }).select().single();
  if (error) throw error;
  return { id: data.id, name: topic.name, status: 'not_studied', totalStudyMinutes: 0, lastStudied: null };
}

export async function updateTopic(topicId, updates) {
  const dbUpdates = {};
  if ('name' in updates) dbUpdates.name = updates.name;
  if ('status' in updates) dbUpdates.status = updates.status;
  if ('totalStudyMinutes' in updates) dbUpdates.total_study_minutes = updates.totalStudyMinutes;
  if ('lastStudied' in updates) dbUpdates.last_studied = updates.lastStudied;
  // Study-methods fields — added by the retrieval-modal flow.
  if ('confidence' in updates) dbUpdates.confidence = updates.confidence;
  if ('last_retrieval_at' in updates) dbUpdates.last_retrieval_at = updates.last_retrieval_at;
  if ('next_review_at' in updates) dbUpdates.next_review_at = updates.next_review_at;
  if ('retrieval_count' in updates) dbUpdates.retrieval_count = updates.retrieval_count;
  if ('feynman_note' in updates) dbUpdates.feynman_note = updates.feynman_note;
  if ('why_difficult' in updates) dbUpdates.why_difficult = updates.why_difficult;
  const { error } = await supabase.from('topics').update(dbUpdates).eq('id', topicId);
  if (error) throw error;
}

export async function deleteTopic(topicId) {
  const { error } = await supabase.from('topics').delete().eq('id', topicId);
  if (error) throw error;
}

// Retrieval attempts — one row per practice-test submission. Feeds the
// spaced-repetition schedule and the stats shown on the subject dashboard.
export async function createRetrievalAttempt(userId, attempt) {
  const { data, error } = await supabase.from('retrieval_attempts').insert({
    user_id: userId,
    topic_id: attempt.topicId,
    subject_id: attempt.subjectId || null,
    score: attempt.score,
    duration_sec: attempt.durationSec || 0,
    response_text: attempt.responseText || null,
  }).select().single();
  if (error) throw error;
  return data;
}

// Exams
export async function createExam(userId, subjectId, exam) {
  const { data, error } = await supabase.from('exams').insert({
    user_id: userId, subject_id: subjectId, name: exam.name, date: exam.date,
  }).select().single();
  if (error) throw error;
  return { id: data.id, name: exam.name, date: exam.date };
}

export async function deleteExam(examId) {
  const { error } = await supabase.from('exams').delete().eq('id', examId);
  if (error) throw error;
}

export async function updateExam(examId, updates) {
  const dbUpdates = {};
  if ('name' in updates) dbUpdates.name = updates.name;
  if ('date' in updates) dbUpdates.date = updates.date;
  const { error } = await supabase.from('exams').update(dbUpdates).eq('id', examId);
  if (error) throw error;
}

// Study sessions
export async function createStudySession(userId, session) {
  const { data, error } = await supabase.from('study_sessions').insert({
    user_id: userId, subject_id: session.subjectId || null, topic_name: session.topicName,
    duration: session.duration, date: session.date, type: session.type || 'focus',
  }).select().single();
  if (error) throw error;
  return {
    id: data.id, subjectId: session.subjectId, topicName: session.topicName,
    duration: session.duration, date: session.date, type: session.type || 'focus',
  };
}

// Water
export async function setWaterLog(userId, date, bottles) {
  const { error } = await supabase.from('water_logs')
    .upsert({ user_id: userId, date, bottles }, { onConflict: 'user_id,date' });
  if (error) throw error;
}

// Home routine
export async function updateHomeRoutine(userId, roomKey, days) {
  const { error } = await supabase.from('home_routine')
    .upsert({ user_id: userId, room_key: roomKey, days }, { onConflict: 'user_id,room_key' });
  if (error) throw error;
}

export async function deleteHomeRoutine(userId, roomKey) {
  const { error } = await supabase.from('home_routine')
    .delete().eq('user_id', userId).eq('room_key', roomKey);
  if (error) throw error;
}

// Canonical labels for the 9 default rooms. Must match Casa.jsx defaultRooms.
// Kept here (not just in Casa.jsx) so the day-board can resolve a routine key
// to a real title without importing the component.
const DEFAULT_ROOM_LABELS = {
  areia_gato: 'Limpar areia do gato', comida_gato: 'Dar comida pro gato',
  sala: 'Limpar sala', quarto: 'Arrumar quarto', escritorio: 'Organizar escritorio',
  banheiro: 'Limpar banheiro', lavanderia: 'Lavar roupas',
  lixo_organico: 'Descer lixo organico', lixo_reciclavel: 'Descer lixo reciclavel',
};

// Resolve a home-routine key to its title. Custom rooms (key "custom_...") live
// in state.customRooms, so we fall back there. Returns null for orphan keys —
// the caller MUST skip those instead of creating a titleless task (that was the
// "broken task on the day board" bug).
export function roomLabelFor(key, customRooms = []) {
  return DEFAULT_ROOM_LABELS[key] || customRooms.find(r => r.key === key)?.label || null;
}

// Materialize today's home routine into real, persisted day-board tasks.
// - Skips rooms not scheduled for today's weekday.
// - Skips orphan keys with no resolvable title.
// - Dedupes against casa tasks already on today's board (by title).
// Returns the created task rows so the caller can merge them into state. Each
// insert is awaited individually so one failure doesn't drop the rest.
export async function ensureTodayRoutineTasks(userId, { tasks, homeRoutine, customRooms }) {
  const today = getDateKey();
  const dow = new Date().getDay();
  const existing = new Set(
    (tasks || [])
      .filter(t => t.date === today && t.category === 'casa')
      .map(t => t.title.toLowerCase())
  );
  const created = [];
  for (const [key, cfg] of Object.entries(homeRoutine || {})) {
    if (!cfg?.days?.includes(dow)) continue;
    const title = roomLabelFor(key, customRooms);
    if (!title || existing.has(title.toLowerCase())) continue;
    try {
      const saved = await createTask(userId, {
        title, category: 'casa', effort: '30', time: '',
        done: false, date: today, recurring: true,
      });
      created.push(saved);
      existing.add(title.toLowerCase());
    } catch (e) { console.error('ensureTodayRoutineTasks failed for', key, e); }
  }
  return created;
}

// Custom rooms
export async function createCustomRoom(userId, room) {
  const { error } = await supabase.from('custom_rooms').insert({
    user_id: userId, key: room.key, label: room.label, icon: room.icon, color: room.color,
  });
  if (error) throw error;
}

export async function deleteCustomRoom(userId, roomKey) {
  const { error } = await supabase.from('custom_rooms')
    .delete().eq('user_id', userId).eq('key', roomKey);
  if (error) throw error;
}

// Kanban
export async function createKanbanCard(userId, card) {
  const { data, error } = await supabase.from('kanban_cards').insert({
    user_id: userId, title: card.title, project: card.project || null,
    priority: card.priority, effort: card.effort, column_name: 'todo',
  }).select().single();
  if (error) throw error;
  return {
    id: data.id, title: card.title, project: card.project,
    priority: card.priority, effort: card.effort, createdAt: data.created_at,
  };
}

export async function moveKanbanCard(cardId, toColumn) {
  const { error } = await supabase.from('kanban_cards')
    .update({ column_name: toColumn }).eq('id', cardId);
  if (error) throw error;
}

export async function deleteKanbanCard(cardId) {
  const { error } = await supabase.from('kanban_cards').delete().eq('id', cardId);
  if (error) throw error;
}

// Profile / Settings
export async function updateProfile(userId, updates) {
  const dbUpdates = { updated_at: new Date().toISOString() };
  if ('weight' in updates) dbUpdates.weight = updates.weight;
  if ('bottleSize' in updates) dbUpdates.bottle_size = updates.bottleSize;
  if ('waterGoal' in updates) dbUpdates.water_goal = updates.waterGoal;
  if ('pomodoroSettings' in updates) dbUpdates.pomodoro_settings = updates.pomodoroSettings;
  const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
  if (error) throw error;
}

// ==========================================================================
// Helpers (unchanged from old store.js)
// ==========================================================================
// Date key in the user's LOCAL timezone. We used to rely on toISOString(),
// which shifts to UTC and caused tasks to jump a day when the user was past
// ~21:00 in Brazil (UTC-3) — "today" in the app silently became tomorrow,
// tasks for today disappeared, "done" toggles saved to the wrong date.
export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDayName(date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' });
}

export function formatDate(date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function generateReviewSchedule(examDate) {
  const exam = new Date(examDate);
  const offsets = [-18, -7, -5, -3, -2];
  return offsets.map(offset => {
    const d = new Date(exam);
    d.setDate(d.getDate() + offset);
    return getDateKey(d);
  }).filter(d => new Date(d) >= new Date(getDateKey()));
}

// ==========================================================================
// Syllabus parser — tries to extract topics and exam/assessment dates out of
// free-text programs scraped from PDFs. PDF extraction flattens layout so
// text often arrives with no line breaks between items; we split on heuristics
// before running line-level classification.
// ==========================================================================

const MONTH_PT = {
  'jan': 1, 'janeiro': 1, 'fev': 2, 'fevereiro': 2, 'mar': 3, 'marco': 3, 'março': 3,
  'abr': 4, 'abril': 4, 'mai': 5, 'maio': 5, 'jun': 6, 'junho': 6,
  'jul': 7, 'julho': 7, 'ago': 8, 'agosto': 8, 'set': 9, 'setembro': 9,
  'out': 10, 'outubro': 10, 'nov': 11, 'novembro': 11, 'dez': 12, 'dezembro': 12,
};

// Headers/noise we want to filter out entirely
const NOISE_PREFIX = /^(professor\b|prof\.?\b|email\b|e-mail\b|horario\b|horário\b|sala\b|credito\b|crédito\b|carga hor|pre.?requisito|pré.?requisito|bibliografia|bibliogr|ementa\b|objetivo\b|objetivos\b|referencia\b|referência\b|site\b|plataforma\b|moodle\b|universidade\b|unicamp\b|faculdade\b|departamento\b|curso\b|turma\b|codigo\b|código\b|ano\b|semestre\b|pagina\b|página\b|cep\b|telefone\b|contato\b|sumário\b|sumario\b|índice\b|indice\b)/i;
const ASSESSMENT_RE = /(prova|exame|avaliac|avaliaç|teste|simulad|quiz|\bp[123456]\b|entrega|deadline|prazo|atividade|trabalho|projeto|seminari|seminár|apresentac|apresentaç|laborator|laboratór|relatorio|relatório)/i;

// Extract a short, human-readable label for an assessment line ("P1", "Prova
// Substitutiva", "Entrega do trabalho final"). Falls back to "Avaliação".
function extractAssessmentLabel(line) {
  // Strip the date FIRST so patterns below don't swallow "15 de junho de 2026"
  // into the label.
  const withoutDate = line.replace(DATE_NUMERIC, ' ').replace(DATE_EXTENSIVE, ' ');
  // Specific named assessments first — these win over generic
  const named = withoutDate.match(/\b(P[1-6]|PS\b|PF\b|Prova\s+(?:Substitutiva|Final|Parcial|\d+)|Simulad(?:o|a)|Quiz|Exame(?:\s+Final)?|Seminári?o|Apresenta(?:cao|ção)|Laborat(?:orio|ório)\s*\d*|Relat(?:orio|ório)|Projeto\s+Final|Entrega\s+(?:do|da|de|final)\s+[^\.,;:\n]{0,30}|Trabalho\s+(?:Final|Parcial)|Atividade\s+\d+|Exercicio\s+\d+|Lista\s+\d+)\b/i);
  if (named) {
    return named[0]
      // Strip trailing connectives that leak from the regex
      .replace(/\s+(de|do|da|em|no|na|com|pelo|pela)\s*$/i, '')
      // And any leftover trailing punctuation
      .replace(/[\s\.,:;\-]+$/, '')
      .trim();
  }
  // Generic fallback: first 60 chars without the date + common connectives
  const generic = withoutDate
    .replace(/\b(data|dia|em|no dia|no|às|as|pesos?|vale|valor)\b/gi, '')
    .replace(/\d+\s*%/g, '')
    .replace(/[\-\:\,\(\)]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s\.,:;\-]+$/, '')
    .trim();
  return generic.slice(0, 60) || 'Avaliacao';
}

// Date patterns we understand
const DATE_NUMERIC = /\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/; // 20/04, 20/04/2026, 20-04
const DATE_EXTENSIVE = /\b(\d{1,2})\s*(?:de\s+)?(jan|janeiro|fev|fevereiro|mar|marco|março|abr|abril|mai|maio|jun|junho|jul|julho|ago|agosto|set|setembro|out|outubro|nov|novembro|dez|dezembro)(?:\s*(?:de\s+)?(\d{2,4}))?\b/i;

function parseDate(line) {
  const num = line.match(DATE_NUMERIC);
  if (num) {
    const day = num[1].padStart(2, '0');
    const month = num[2].padStart(2, '0');
    const year = num[3]
      ? (num[3].length === 2 ? '20' + num[3] : num[3])
      : String(new Date().getFullYear());
    // Sanity check — avoid matching random numeric pairs like "Cap 1.2"
    if (+num[1] >= 1 && +num[1] <= 31 && +num[2] >= 1 && +num[2] <= 12) {
      return { date: `${year}-${month}-${day}`, raw: num[0] };
    }
  }
  const ext = line.match(DATE_EXTENSIVE);
  if (ext) {
    const day = ext[1].padStart(2, '0');
    const month = String(MONTH_PT[ext[2].toLowerCase()]).padStart(2, '0');
    const year = ext[3]
      ? (ext[3].length === 2 ? '20' + ext[3] : ext[3])
      : String(new Date().getFullYear());
    return { date: `${year}-${month}-${day}`, raw: ext[0] };
  }
  return null;
}

function cleanTopicLine(line) {
  return line
    // drop common list-marker prefixes (numbers, bullets, roman-ish enumerators)
    .replace(/^[\s\u2022\-\*]+/, '')
    // Numeric enumerators including sub-items: "1.", "1.1", "2.3.1"
    .replace(/^(?:[ivxlcIVXLC]{1,5}|\d{1,3}(?:\.\d{1,3})*)[\.\)\-:]\s*/, '')
    // Leftover isolated numeric label like "1 Modelos" (no dot)
    .replace(/^\d{1,3}\s+(?=[A-Za-zÀ-ÿ])/, '')
    .replace(/^(?:capitulo|capítulo|unidade|aula|topico|tópico|modulo|módulo|parte|secao|seção)\s+\d+[\.\)\-:]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Detects lines that look like bibliography entries so they don't pollute
// the topic list. Book references follow predictable shapes:
//   "Autor, N. Título. Editora, ANO."
//   "Sobrenome, I.N. Título, ANO"
//   "N. Sobrenome, N. Sobrenome. Título. Publisher"
// Heuristics combined: publisher keyword, trailing year, or the typical
// "N. Surname" / "Surname, N." authorship pattern.
const PUBLISHER_RE = /\b(editora|edit\.\s|ed\.\s|publisher|press|wiley|elsevier|springer|prentice|mcgraw|pearson|addison|cengage|thomson|oxford|cambridge|bookman|atlas|blucher|lcte?|edusp|unicamp)\b/i;
const TRAILING_YEAR_RE = /,?\s*(?:19|20)\d{2}\s*\.?\s*$/;
const AUTHOR_INITIAL_RE = /\b[A-Z]\.\s*(?:[A-Z]\.\s*)?[A-Z][a-z]{2,}/;   // "A. Silva" / "A. B. Silva"
const SURNAME_INITIAL_RE = /^[A-Z][a-zÀ-ÿ]{2,}(?:\s+[A-Z][a-zÀ-ÿ]{2,})?,\s*[A-Z]\./;  // "Silva, J."

function looksLikeBibliography(line) {
  if (PUBLISHER_RE.test(line)) return true;
  if (TRAILING_YEAR_RE.test(line)) return true;
  // Two+ initials suggest an author list
  const initialMatches = line.match(/\b[A-Z]\.\s*/g);
  if (initialMatches && initialMatches.length >= 2) return true;
  if (AUTHOR_INITIAL_RE.test(line) && /\./.test(line)) return true;
  if (SURNAME_INITIAL_RE.test(line)) return true;
  return false;
}

// Some PDFs flatten multiple exam entries into one paragraph, e.g.
// "Prova 1. Prova 2 18 de junho. Exame 16 de julho."
// Split such paragraphs into sub-chunks that each carry at most one date,
// so every exam gets its own row. Safe for normal topic lines — a line with
// zero assessment keywords returns [line] untouched.
function splitMultipleAssessments(line) {
  // Only pre-split when we see multiple assessment mentions in the same line.
  const matches = line.match(/(prova|exame|avaliac|avaliaç|teste|simulad|quiz|\bp[1-6]\b|entrega|seminári?o|apresentac|apresentaç|trabalho|projeto|lista|exercicio|atividade|relat)/gi);
  if (!matches || matches.length < 2) return [line];
  // Split on "." or ";" followed by whitespace — conservative so we don't
  // shred real topic sentences. Empty chunks are dropped by the caller.
  return line
    .split(/\s*[\.;]\s+(?=[A-Z\u00C0-\u00DC])/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Split PDF-flattened text into reasonable line candidates. Most course PDFs
// use numbered items ("1.", "2.1 ") or bullets; we force a line break before
// those markers even when the extraction produced one big paragraph.
function splitIntoLines(text) {
  return text
    .replace(/\r/g, '\n')
    // Break before numbered items (1., 1.1, 2), handling long paragraphs
    .replace(/\s(?=\d{1,2}[\.\)]\s+[A-Za-zÀ-ÿ])/g, '\n')
    // Break before bullets
    .replace(/\s(?=[\u2022\-\*]\s+[A-Za-zÀ-ÿ])/g, '\n')
    // Break before headline words
    .replace(/\s(?=(?:Aula|Capitulo|Capítulo|Unidade|Modulo|Módulo|Parte)\s+\d)/g, '\n')
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);
}

function dedupePreservingOrder(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function parseSyllabus(text) {
  if (!text || !text.trim()) return { topics: [], exams: [] };

  const lines = splitIntoLines(text);
  const topics = [];
  const exams = [];

  for (const rawLineInput of lines) {
    if (rawLineInput.length < 4 || rawLineInput.length > 400) continue;

    // Pre-split lines that bundle multiple assessments ("Prova 1. Prova 2 18
    // de junho. Exame 16 de julho.") into individual chunks so each gets its
    // own date. Plain topic lines pass through unchanged.
    for (const rawLine of splitMultipleAssessments(rawLineInput)) {
      if (rawLine.length < 4) continue;

      const dateInfo = parseDate(rawLine);
      const isAssessment = ASSESSMENT_RE.test(rawLine);

      // --- Exam / assessment with a date: capture both ---
      if (dateInfo && isAssessment) {
        exams.push({
          name: extractAssessmentLabel(rawLine),
          date: dateInfo.date,
        });
        continue;
      }

      // --- Skip header / metadata lines entirely ---
      if (NOISE_PREFIX.test(rawLine)) continue;
      // --- Skip bibliography entries (authors, publishers, trailing year) ---
      if (looksLikeBibliography(rawLine)) continue;

      // --- Otherwise treat as a topic (clean it up) ---
      const cleaned = cleanTopicLine(rawLine);
      if (cleaned.length < 4) continue;
      // Skip pure dates on their own (they're not topics)
      if (/^\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?$/.test(cleaned)) continue;
      // Skip section titles that introduce another section but have no content
      if (/^(sumario|sumário|indice|índice|conteudo programatico|conteúdo programático|cronograma|avaliac(?:ao|ão|oes|ões)|bibliografia|referencias|referências|objetivos|ementa|metodologia|introduc(?:ao|ão)|topicos|tópicos|provas|atividades)\s*:?$/i.test(cleaned)) continue;
      // Skip single numbers / page numbers / roman numerals
      if (/^\d+$/.test(cleaned) || /^[ivxlcIVXLC]+$/.test(cleaned)) continue;
      // Skip lines that are mostly symbols/punctuation
      const letterRatio = (cleaned.match(/\p{L}/gu) || []).length / cleaned.length;
      if (letterRatio < 0.5) continue;
      // Skip lines that look like URLs or emails
      if (/https?:\/\/|www\.|@\S+\.\S+/i.test(cleaned)) continue;
      // Skip stray assessment-only words without date (e.g. "Prova 1 .")
      if (isAssessment && !dateInfo && cleaned.length < 15 && /^(prova|exame|p[1-6]|teste|quiz|simulado|seminari?o)\s*\d*\s*[\.:]*\s*$/i.test(cleaned)) continue;

      topics.push({
        name: cleaned.slice(0, 100),
        status: 'not_studied',
        totalStudyMinutes: 0,
        lastStudied: null,
      });
    }
  }

  return {
    topics: dedupePreservingOrder(topics, t => t.name.toLowerCase()),
    exams: dedupePreservingOrder(exams, e => `${e.name.toLowerCase()}|${e.date}`),
  };
}

// Legacy signature retained below as _parseSyllabusLegacy for reference
// eslint-disable-next-line no-unused-vars
function _parseSyllabusLegacy(text) {
  const lines = text
    .split('\n')
    .map(l => l.replace(/^[\s\-\*\d\.\)\]]+/, '').trim())
    .filter(l => l.length > 2 && l.length < 120);

  const topics = [];
  const exams = [];
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;

  for (const line of lines) {
    const dateMatch = line.match(dateRegex);
    if (dateMatch && /prova|exame|avalia|test/i.test(line)) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      const year = dateMatch[3] ? (dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]) : new Date().getFullYear().toString();
      exams.push({
        name: line.replace(dateRegex, '').replace(/[\-\:\,]+$/, '').trim() || 'Prova',
        date: `${year}-${month}-${day}`,
      });
    } else if (!/^(professor|email|horario|sala|credito|carga|pre.?requisito|bibliografia|ementa)/i.test(line)) {
      topics.push({
        name: line.slice(0, 80),
        status: 'not_studied',
        totalStudyMinutes: 0,
        lastStudied: null,
      });
    }
  }

  return { topics, exams };
}

export function getSubjectStudyStats(sessions, subjectId) {
  const subjectSessions = sessions.filter(s => s.subjectId === subjectId && s.type === 'focus');
  const totalMinutes = subjectSessions.reduce((sum, s) => sum + s.duration, 0);
  const topicMinutes = {};
  subjectSessions.forEach(s => {
    topicMinutes[s.topicName] = (topicMinutes[s.topicName] || 0) + s.duration;
  });
  return { totalMinutes, topicMinutes, sessionCount: subjectSessions.length };
}

export function getTodayReviews(subjects) {
  const today = getDateKey();
  const reviews = [];
  for (const subject of subjects) {
    for (const exam of subject.exams || []) {
      const schedule = generateReviewSchedule(exam.date);
      if (schedule.includes(today)) {
        reviews.push({
          subjectName: subject.name,
          subjectId: subject.id,
          examName: exam.name,
          examDate: exam.date,
        });
      }
    }
  }
  return reviews;
}

export { defaultState };
