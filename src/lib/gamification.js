import { getDateKey } from './attendance.js';

// Gamification is fully DERIVED from existing state — no stored counters, so it
// can never double-count or desync. Streak, XP, level and rings are pure
// functions of tasks / sessions / water / topics.

const STREAK_THRESHOLD = 0.8;   // 80% of the day's tasks effectively done
const FOCUS_GOAL_MIN = 50;      // ~2 pomodoros = a "full" focus ring
const SHIELDS_PER_MONTH = 2;    // auto-saves a missed day, max 2 per calendar month
// XP tem que seguir o que a evidencia diz que ensina, nao o que e facil de
// clicar. Antes agua valia 20 e um pomodoro de foco valia 15: beber agua rendia
// mais que 25 minutos de estudo. Retrieval practice e a tecnica de utilidade
// mais alta (Dunlosky 2013), entao lidera; agua vira simbolica.
// Ver docs/METODOS.md secao 1.
const XP = { task: 10, pomodoro: 30, water: 5, retrieval: 50 };

// XP da tarefa proporcional ao esforco. Com XP fixo, escovar o dente (5min)
// valia igual a limpar a sala (30min), e as 8 ancoras diarias da rotina
// rendiam mais que dois pomodoros de estudo. A tarefa curta continua dando
// ponto — a sensacao de cumprir e o objetivo dela — so nao empata com meia
// hora de trabalho.
const XP_POR_ESFORCO = { '5': 2, '10': 3, '30': 10, '60': 20, '120': 30 };
export const xpDaTarefa = (t) => XP_POR_ESFORCO[String(t.effort)] ?? XP.task;

// A task counts as done only when checked AND its pomodoro requirement is met.
export function effectiveDone(t) {
  const req = t.required_pomodoros || 0;
  return !!t.done && (req === 0 || (t.pomodoros_done || 0) >= req);
}

export function pomodoroGated(t) {
  return (t.required_pomodoros || 0) > 0 && (t.pomodoros_done || 0) < t.required_pomodoros;
}

const shift = (s, n) => {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const prevDay = (s) => shift(s, -1);
const nextDay = (s) => shift(s, 1);

function focusByDate(state) {
  const m = {};
  for (const s of state.studySessions || []) if (s.type === 'focus') m[s.date] = (m[s.date] || 0) + 1;
  return m;
}
function tasksByDate(tasks) {
  const m = {};
  for (const t of tasks || []) {
    if (!t.date) continue;
    (m[t.date] ||= { total: 0, done: 0 }).total++;
    if (effectiveDone(t)) m[t.date].done++;
  }
  return m;
}
// A day is "kept" (counts for the streak) if you did the floor: >=80% of the
// day's tasks OR at least 1 focus pomodoro. An idle day is a miss.
function keptDay(byDate, focus, date) {
  const rec = byDate[date];
  const tasksOk = rec && rec.total > 0 && rec.done / rec.total >= STREAK_THRESHOLD;
  return tasksOk || (focus[date] || 0) >= 1;
}

// Forward scan → current streak, best ever, shields used this month, at-risk.
// A missed past day is auto-bridged by a shield (max 2 per calendar month);
// out of shields → the streak breaks. Today never breaks or spends a shield.
export function computeProgress(state, today = getDateKey()) {
  const byDate = tasksByDate(state.tasks || []);
  const focus = focusByDate(state);
  const dates = [...Object.keys(byDate), ...Object.keys(focus)];
  const atRisk = !keptDay(byDate, focus, today);
  if (!dates.length) return { streak: 0, best: 0, shieldsUsed: 0, shieldsLeft: SHIELDS_PER_MONTH, atRisk, ativos30: 0 };
  const start = dates.sort()[0];
  const curMonth = today.slice(0, 7);
  let run = 0, best = 0, curMonthShields = 0, month = null, monthShields = 0;
  for (let d = start; d <= today; d = nextDay(d)) {
    const mo = d.slice(0, 7);
    if (mo !== month) { month = mo; monthShields = 0; }
    if (keptDay(byDate, focus, d)) { run++; best = Math.max(best, run); }
    else if (d === today) { /* in progress — don't break or spend a shield */ }
    else if (monthShields < SHIELDS_PER_MONTH) { monthShields++; } // bridge the gap
    else { run = 0; }
    if (mo === curMonth) curMonthShields = monthShields;
  }
  // Dias ativos nos ultimos 30. Existe porque o streak zera inteiro com uma
  // falha, e streak zerado depois de um mes ruim vira auto-critica — que a
  // pesquisa liga a MAIS procrastinacao, nao menos (Neff; Sirois sobre
  // autocompaixao e procrastinacao). Este numero nao pode ser destruido por um
  // dia perdido: ele so sobe quando voce aparece.
  let ativos30 = 0;
  for (let i = 0, d = today; i < 30; i++, d = prevDay(d)) {
    if (keptDay(byDate, focus, d)) ativos30++;
  }
  return { streak: run, best, shieldsUsed: curMonthShields,
           shieldsLeft: SHIELDS_PER_MONTH - curMonthShields, atRisk, ativos30 };
}

// Focus pomodoros + tasks done per day for the last N days (for the chart).
export function dailyActivity(state, days = 21, today = getDateKey()) {
  const focus = focusByDate(state);
  const byDate = tasksByDate(state.tasks || []);
  const out = [];
  let d = today;
  for (let i = 0; i < days; i++) {
    out.unshift({ date: d, pomodoros: focus[d] || 0, done: byDate[d]?.done || 0, kept: keptDay(byDate, focus, d) });
    d = prevDay(d);
  }
  return out;
}

const xpForLevel = (lvl) => 50 * lvl * (lvl - 1); // L1:0 L2:100 L3:300 L4:600 ...
function levelForXp(xp) {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

export function computeStats(state, today = getDateKey()) {
  const tasks = state.tasks || [];
  const feitas = tasks.filter(effectiveDone);
  const doneTasks = feitas.length;
  const xpTarefas = feitas.reduce((n, t) => n + xpDaTarefa(t), 0);
  const focusSessions = (state.studySessions || []).filter((s) => s.type === 'focus').length;

  const goalMl = state.settings?.waterGoal || 0;
  const size = state.settings?.bottleSize || 700;
  let waterDays = 0;
  for (const bottles of Object.values(state.water || {})) {
    if (goalMl && bottles * size >= goalMl) waterDays++;
  }

  let retrieval = 0;
  for (const s of state.subjects || []) for (const t of s.topics || []) retrieval += t.retrieval_count || 0;

  const xp = xpTarefas + focusSessions * XP.pomodoro + waterDays * XP.water + retrieval * XP.retrieval;
  const level = levelForXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const prog = computeProgress(state, today);

  return {
    xp,
    level,
    xpIntoLevel: xp - cur,
    xpForNext: next - cur,
    levelProgress: (xp - cur) / (next - cur),
    streak: prog.streak,
    best: prog.best,
    shieldsLeft: prog.shieldsLeft,
    shieldsUsed: prog.shieldsUsed,
    atRisk: prog.atRisk,
    rings: computeRings(state, today),
  };
}

export function computeRings(state, today = getDateKey()) {
  const todays = (state.tasks || []).filter((t) => t.date === today);
  const doneEff = todays.filter(effectiveDone).length;
  const tasksVal = todays.length ? doneEff / todays.length : 0;

  const focusMin = (state.studySessions || [])
    .filter((s) => s.date === today && s.type === 'focus')
    .reduce((a, s) => a + s.duration, 0);

  const bottles = state.water?.[today] || 0;
  const ml = bottles * (state.settings?.bottleSize || 700);
  const goalMl = state.settings?.waterGoal || 0;

  return {
    tasks: { val: Math.min(1, tasksVal), label: `${doneEff}/${todays.length}`, pct: Math.round(tasksVal * 100) },
    focus: { val: Math.min(1, focusMin / FOCUS_GOAL_MIN), label: `${focusMin}m`, pct: Math.round(Math.min(1, focusMin / FOCUS_GOAL_MIN) * 100) },
    water: { val: goalMl ? Math.min(1, ml / goalMl) : 0, label: `${bottles}`, pct: goalMl ? Math.round(Math.min(1, ml / goalMl) * 100) : 0 },
  };
}
