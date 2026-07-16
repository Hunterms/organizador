import { getDateKey } from '../store';

// Gamification is fully DERIVED from existing state — no stored counters, so it
// can never double-count or desync. Streak, XP, level and rings are pure
// functions of tasks / sessions / water / topics.

const STREAK_THRESHOLD = 0.8;   // 80% of the day's tasks effectively done
const FOCUS_GOAL_MIN = 50;      // ~2 pomodoros = a "full" focus ring
const XP = { task: 10, pomodoro: 15, water: 20, retrieval: 25 };

// A task counts as done only when checked AND its pomodoro requirement is met.
export function effectiveDone(t) {
  const req = t.required_pomodoros || 0;
  return !!t.done && (req === 0 || (t.pomodoros_done || 0) >= req);
}

export function pomodoroGated(t) {
  return (t.required_pomodoros || 0) > 0 && (t.pomodoros_done || 0) < t.required_pomodoros;
}

const prevDay = (s) => {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Consecutive days meeting the 80% rule, walking back from today. Days with no
// tasks are transparent (grace — they neither break nor extend the streak).
// Today counts only once it hits 80%; before that the streak reflects the run
// ending yesterday (today shown separately as "at risk / in progress").
export function computeStreak(tasks, today = getDateKey()) {
  const byDate = {};
  for (const t of tasks || []) {
    if (!t.date) continue;
    (byDate[t.date] ||= { total: 0, done: 0 }).total++;
    if (effectiveDone(t)) byDate[t.date].done++;
  }
  const dates = Object.keys(byDate);
  if (!dates.length) return 0;
  const earliest = dates.sort()[0];
  let streak = 0;
  let d = today;
  while (d >= earliest) {
    const rec = byDate[d];
    if (!rec) { d = prevDay(d); continue; }          // no tasks → grace
    const won = rec.done / rec.total >= STREAK_THRESHOLD;
    if (won) { streak++; d = prevDay(d); continue; }
    if (d === today) { d = prevDay(d); continue; }    // today still in progress
    break;                                            // a past day fell short
  }
  return streak;
}

// True when today has tasks but hasn't hit 80% yet — used to nudge ("finish to
// keep your streak").
export function streakAtRisk(tasks, today = getDateKey()) {
  const todays = (tasks || []).filter((t) => t.date === today);
  if (!todays.length) return false;
  const done = todays.filter(effectiveDone).length;
  return done / todays.length < STREAK_THRESHOLD;
}

const xpForLevel = (lvl) => 50 * lvl * (lvl - 1); // L1:0 L2:100 L3:300 L4:600 ...
function levelForXp(xp) {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

export function computeStats(state, today = getDateKey()) {
  const tasks = state.tasks || [];
  const doneTasks = tasks.filter(effectiveDone).length;
  const focusSessions = (state.studySessions || []).filter((s) => s.type === 'focus').length;

  const goalMl = state.settings?.waterGoal || 0;
  const size = state.settings?.bottleSize || 700;
  let waterDays = 0;
  for (const bottles of Object.values(state.water || {})) {
    if (goalMl && bottles * size >= goalMl) waterDays++;
  }

  let retrieval = 0;
  for (const s of state.subjects || []) for (const t of s.topics || []) retrieval += t.retrieval_count || 0;

  const xp = doneTasks * XP.task + focusSessions * XP.pomodoro + waterDays * XP.water + retrieval * XP.retrieval;
  const level = levelForXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);

  return {
    xp,
    level,
    xpIntoLevel: xp - cur,
    xpForNext: next - cur,
    levelProgress: (xp - cur) / (next - cur),
    streak: computeStreak(tasks, today),
    atRisk: streakAtRisk(tasks, today),
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
