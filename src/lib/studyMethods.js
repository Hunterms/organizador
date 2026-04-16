// ==========================================================================
// Evidence-backed study methods — calculators and planners
// ==========================================================================
// Sources: Dunlosky 2013, Karpicke & Roediger (retrieval practice),
// Cepeda & Rohrer (spaced practice), Bjork (desirable difficulties).
// ==========================================================================

import { getDateKey } from '../store';

// ---- Spaced repetition: next-review scheduler (SM-2 lite) -----------------
// Map a self-rated retrieval score (1-5) to the next review interval in days.
// Each successful repetition at the same level roughly doubles the gap; we
// keep this simple and deterministic instead of running full SM-2.
const INTERVAL_DAYS = { 1: 1, 2: 2, 3: 4, 4: 10, 5: 21 };

export function calculateNextReview(score, previousConfidence = 0) {
  const base = INTERVAL_DAYS[score] || 1;
  // If the user is consistently nailing it (prev >= 4 and new score 5),
  // stretch the interval to avoid over-reviewing material they own.
  const multiplier = (score === 5 && previousConfidence >= 4) ? 2 : 1;
  const days = Math.min(base * multiplier, 60);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getDateKey(d);
}

// ---- Today's review queue -------------------------------------------------
// Returns topics whose next_review_at <= today. Sorted by how overdue they
// are (most overdue first) — the literature says missed reviews decay fast.
export function getTodayReviewQueue(subjects) {
  const today = getDateKey();
  const queue = [];
  for (const subject of subjects || []) {
    for (const topic of subject.topics || []) {
      if (!topic.next_review_at) continue;
      if (topic.next_review_at > today) continue;
      queue.push({
        topicId: topic.id,
        topicName: topic.name,
        subjectId: subject.id,
        subjectName: subject.name,
        confidence: topic.confidence || 0,
        status: topic.status,
        nextReviewAt: topic.next_review_at,
        daysOverdue: Math.max(0, Math.floor(
          (new Date(today) - new Date(topic.next_review_at)) / 86400000
        )),
      });
    }
  }
  // Most overdue first; tie-break by lowest confidence (those need it more)
  queue.sort((a, b) => b.daysOverdue - a.daysOverdue || a.confidence - b.confidence);
  return queue;
}

// ---- Interleaved session: one topic per subject, up to N ------------------
// Interleaving (Rohrer, Taylor) — mixing topics across subjects in the same
// session beats blocked practice, especially in math/physics.
export function generateInterleavedSession(subjects, max = 5) {
  // Pick one random topic per subject, prefer those with low confidence or
  // never retrieved. Falls back to any topic if the subject has no weak one.
  const picks = [];
  const shuffledSubjects = [...(subjects || [])].sort(() => Math.random() - 0.5);

  for (const subject of shuffledSubjects) {
    if (picks.length >= max) break;
    const topics = subject.topics || [];
    if (topics.length === 0) continue;
    const weak = topics.filter(t => (t.confidence || 0) < 4);
    const pool = weak.length > 0 ? weak : topics;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    picks.push({
      topicId: chosen.id,
      topicName: chosen.name,
      subjectId: subject.id,
      subjectName: subject.name,
      confidence: chosen.confidence || 0,
      status: chosen.status,
    });
  }
  return picks;
}

// ---- Crunch plan: prioritization when an exam is close --------------------
// Given a subject with an upcoming exam (days away), return a priority-
// ordered plan of topics based on Bjork's "desirable difficulty" heuristic:
//   1. Near-mastery topics (difficulty + confidence 2-3) — highest gain/hr
//   2. Mastered topics needing a quick retrieval refresh
//   3. Never-studied topics — learn just the minimum for partial credit
export function buildCrunchPlan(subject, daysUntilExam) {
  const topics = subject.topics || [];
  const buckets = { nearMastery: [], refreshMastered: [], minimumFloor: [] };

  for (const t of topics) {
    const conf = t.confidence || 0;
    if (t.status === 'difficulty' || (conf >= 2 && conf <= 3)) {
      buckets.nearMastery.push(t);
    } else if (t.status === 'mastered' || conf >= 4) {
      buckets.refreshMastered.push(t);
    } else {
      buckets.minimumFloor.push(t);
    }
  }
  // Sort each bucket: nearMastery by confidence desc (closest to 4 first),
  // refreshMastered by stalest review (lowest confidence first).
  buckets.nearMastery.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  buckets.refreshMastered.sort((a, b) => (a.confidence || 0) - (b.confidence || 0));

  return {
    daysUntilExam,
    totalTopics: topics.length,
    sections: [
      { label: 'Ataque agora (quase domínio)', tone: 'urgent', topics: buckets.nearMastery, method: 'Practice testing: 25min de problemas antigos por tópico, sem olhar solução.' },
      { label: 'Refresh rápido (dominados)', tone: 'primary', topics: buckets.refreshMastered, method: 'Retrieval de 2min por tópico: escreva de memória o conceito-chave.' },
      { label: 'Piso mínimo (não estudados)', tone: 'muted', topics: buckets.minimumFloor, method: 'Só fórmulas + 1 exemplo resolvido. Mirar pontuação parcial.' },
    ],
  };
}

// ---- Helper: does any subject need crunch mode? --------------------------
// Returns the most urgent subject with an exam in <=7 days AND progress <70%.
export function getSubjectInCrunch(subjects) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let mostUrgent = null;

  for (const subject of subjects || []) {
    const topics = subject.topics || [];
    if (topics.length === 0) continue;
    const mastered = topics.filter(t => t.status === 'mastered').length;
    const progress = Math.round((mastered / topics.length) * 100);

    for (const exam of subject.exams || []) {
      const examDate = new Date(exam.date);
      const days = Math.ceil((examDate - today) / 86400000);
      if (days < 0 || days > 7) continue;
      if (progress >= 70) continue;
      if (!mostUrgent || days < mostUrgent.days) {
        mostUrgent = { subject, exam, days, progress };
      }
    }
  }
  return mostUrgent;
}

// ---- Effective-study flag: how real is the time spent? --------------------
// Flag tópicos that have been "studied" (total_study_minutes > 15) but have
// NO retrieval attempt — that's passive time (reading/highlighting) the
// literature says is wasted. Shown as a gentle nudge in the UI.
export function flagPassiveStudy(subject) {
  return (subject.topics || []).filter(t =>
    (t.totalStudyMinutes || 0) >= 15 && (t.retrieval_count || 0) === 0
  );
}
