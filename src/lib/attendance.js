// Regra de presenca da Unicamp (75%), separada do store porque e logica pura:
// nao toca banco, nao toca React, e da pra testar sozinha.
// Ver src/lib/attendance.test.mjs.

export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Toda ocorrencia de aula de uma materia entre duas datas (inclusive), expandida
// do class_schedule semanal. `hours` sai do duration do slot porque a regra dos
// 75% da Unicamp conta hora-aula, nao "quantas vezes voce apareceu": um bloco de
// 4h que voce perde vale o dobro de um de 2h.
export function classDates(subject, from, to) {
  const out = [];
  const slots = subject.class_schedule || [];
  if (!from || !to || !slots.length) return out;
  // A materia manda no proprio recorte: MC621 comeca 21/08 mesmo com o semestre
  // aberto em 10/08. Fora dele, aula nenhuma existe.
  const ini = subject.start_date && subject.start_date > from ? subject.start_date : from;
  const fim = subject.end_date && subject.end_date < to ? subject.end_date : to;
  if (ini > fim) return out;
  const skip = new Set(subject.skip_dates || []);
  // Meio-dia evita que horario de verao empurre a data pro dia anterior.
  const cur = new Date(ini + 'T12:00:00');
  const end = new Date(fim + 'T12:00:00');
  if (isNaN(cur) || isNaN(end)) return out;
  while (cur <= end) {
    const dow = cur.getDay();
    const key = getDateKey(cur);
    if (!skip.has(key)) {
      for (const sl of slots) {
        if (sl.day === dow) {
          out.push({ date: key, time: sl.time || '', room: sl.room || '', hours: (sl.duration || 120) / 60 });
        }
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// Resumo de presenca de uma materia, em HORAS-AULA.
// Com semesterStart/semesterEnd no perfil, o total sai da grade real. Sem elas,
// cai na estimativa de 16 semanas (e `unmarked` fica zerado, porque nao da pra
// saber quais aulas ja aconteceram).
const SEMESTER_WEEKS = 16;
export function attendanceSummary(subject, attendance, settings = {}, today = getDateKey()) {
  // Materia que ele nao frequenta nao tem falta pra contar. Devolver zeros e
  // mais honesto que devolver um limite que nao vale.
  if (subject.attends === false) {
    return { slots: 0, weekHours: 0, totalPlanned: 0, maxMisses: 0, absences: 0,
             presents: 0, remaining: 0, past: 0, unmarked: 0, tracked: false };
  }
  const slots = subject.class_schedule || [];
  const weekHours = slots.reduce((n, sl) => n + (sl.duration || 120) / 60, 0);
  const { semesterStart, semesterEnd } = settings;
  const all = classDates(subject, semesterStart, semesterEnd);
  const totalHours = all.length ? all.reduce((n, c) => n + c.hours, 0) : weekHours * SEMESTER_WEEKS;
  const maxMisses = Math.floor(totalHours * 0.25);

  const byDate = new Map(all.map(c => [c.date, c]));
  const fallbackHours = slots.length ? weekHours / slots.length : 2;
  const hoursOf = d => byDate.get(d)?.hours ?? fallbackHours;

  const records = (attendance || []).filter(a => a.subjectId === subject.id);
  const absences = records.filter(a => a.status === 'absent').reduce((n, a) => n + hoursOf(a.date), 0);
  const presents = records.filter(a => a.status === 'present').reduce((n, a) => n + hoursOf(a.date), 0);

  const marked = new Set(records.map(a => a.date));
  const past = all.filter(c => c.date <= today);
  const unmarked = past.filter(c => !marked.has(c.date)).length;

  return {
    slots: slots.length, weekHours, totalPlanned: totalHours, maxMisses,
    absences, presents, remaining: Math.max(0, maxMisses - absences),
    past: past.length, unmarked, tracked: true,
  };
}

// Grau de alerta de falta, em 4 degraus. Usado pelo mesmo helper em AulasHoje,
// Estudos e Presenca, pra a cor significar sempre a mesma coisa.
//
// A regua e "quantas AULAS ainda posso perder", nao percentual do limite.
// Percentual engana: 70% gasto soa morno, mas se a aula vale 4h e sobrou 6h,
// voce tem uma aula e meia e nao pode faltar na proxima.
export function aulasRestantes(resumo) {
  const { remaining = 0, weekHours = 0, slots = 0 } = resumo || {};
  const porAula = slots ? weekHours / slots : 0;
  if (!porAula) return Infinity;
  return remaining / porAula;
}

export function attendanceLevel(resumo) {
  if (!resumo || !resumo.maxMisses) return 'ok';
  if (resumo.remaining <= 0) return 'estourado';
  const n = aulasRestantes(resumo);
  if (n < 2) return 'perigo';    // a proxima falta e quase a ultima
  if (n < 4) return 'atencao';
  return 'ok';
}
