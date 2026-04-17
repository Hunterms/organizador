// ==========================================================================
// Linha 110 — Moradia Estudantil ↔ Campus Unicamp
// ==========================================================================
// Horários extraídos do PDF oficial da Prefeitura Universitária (2026).
// Trajeto dentro do campus pode mudar após 20h (portaria 2) — não altera
// os horários de saída, apenas o retorno.
// ==========================================================================

// Horários de SAÍDA da Moradia em direção ao Campus (IDA).
// Guardamos como "HH:MM" 24h pra comparação simples por string.
// Marca (A), (B), (C), (P) ignorada pra efeito de "pegar o ônibus".
const IDA_WEEKDAY = [
  '06:30','06:45','06:50','07:00','07:10','07:15','07:20','07:25','07:35','07:40','07:45',
  '08:00','08:10','08:20','08:30','08:40','08:50',
  '09:00','09:10','09:20','09:30','09:40','09:45',
  '10:05','10:15','10:30','10:45',
  '11:00','11:20','11:30','11:45',
  '12:00','12:15','12:20','12:35','12:45',
  '13:00','13:05','13:20','13:30','13:45',
  '14:00','14:15','14:30','14:45',
  '15:00','15:15','15:30','15:45',
  '16:00','16:15','16:30','16:45',
  '17:00','17:30','17:50',
  '18:00','18:10','18:20','18:25','18:30','18:40','18:55',
  '19:00','19:15','19:25','19:35','19:50','19:55',
  '20:10','20:30','20:45',
];

// Sábados têm um serviço reduzido (veja PDF). Domingo não tem.
const IDA_SATURDAY = [
  '06:40','06:50','07:00','07:10','07:20','07:30','07:40','07:50',
  '08:00','08:10','08:20','08:30','08:40','08:50',
  '09:00',
  '10:20','10:40','10:50',
  '11:00','11:10','11:20','11:30','11:40','11:50',
  '12:00','12:10','12:20','12:30','12:40','12:50',
  '13:00','13:10','13:20','13:30','13:40','13:50',
  '14:00','14:10','14:20','14:30','14:40',
];

// Default user-configurable timings. Can be overridden from settings later.
export const DEFAULT_CIRCULAR_CONFIG = {
  walkHomeToStop: 10,    // min — home → Moradia stop
  busRide:         5,    // min — Moradia stop → Unicamp stop
  walkStopToClass: 7,    // min — Unicamp stop → classroom
  buffer:          5,    // min — safety before class starts
  waitAtStop:      2,    // min — be at the stop slightly early
};

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(mins) {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// 0 = Sunday, 6 = Saturday — matches Date.prototype.getDay().
function scheduleFor(dayOfWeek) {
  if (dayOfWeek === 0) return [];             // Sunday: no 110 service
  if (dayOfWeek === 6) return IDA_SATURDAY;   // Saturday: reduced service
  return IDA_WEEKDAY;                         // Mon–Fri
}

// Given a class start time ("HH:MM") and the day of week, return the best
// departure plus the moment you should leave home. Returns null if no bus
// runs early enough to get you there.
export function planTrip(classStartTime, dayOfWeek = new Date().getDay(), cfg = DEFAULT_CIRCULAR_CONFIG) {
  if (!classStartTime || !/^\d{2}:\d{2}$/.test(classStartTime)) return null;
  const schedule = scheduleFor(dayOfWeek);
  if (schedule.length === 0) {
    return { noService: true, dayOfWeek };
  }

  const classMins      = toMinutes(classStartTime);
  const arriveClassBy  = classMins - cfg.buffer;               // be AT the class
  const arriveCampusBy = arriveClassBy - cfg.walkStopToClass;  // at Unicamp stop
  const departMoradiaBy = arriveCampusBy - cfg.busRide;        // bus must depart

  // Pick the LATEST bus that still departs by our deadline.
  let chosen = null;
  for (const t of schedule) {
    if (toMinutes(t) <= departMoradiaBy) chosen = t;
    else break;
  }

  if (!chosen) {
    // No bus early enough — surface the first available and the caller
    // can tell the user they'll be late.
    return {
      tooLate: true,
      earliestBus: schedule[0],
      classStartTime,
      dayOfWeek,
    };
  }

  const chosenMins = toMinutes(chosen);
  const leaveHomeAt = fromMinutes(chosenMins - cfg.walkHomeToStop - cfg.waitAtStop);
  const arriveCampusAt = fromMinutes(chosenMins + cfg.busRide);
  const arriveClassAt  = fromMinutes(chosenMins + cfg.busRide + cfg.walkStopToClass);

  return {
    ok: true,
    busDeparture:   chosen,
    leaveHomeAt,
    arriveCampusAt,
    arriveClassAt,
    classStartTime,
    dayOfWeek,
    config: cfg,
  };
}

// Build the companion task payload for a given class task.
// Returns null if we can't compute a trip for that class.
export function buildCircularTask(classTask, cfg = DEFAULT_CIRCULAR_CONFIG) {
  if (!classTask?.time || !classTask?.date) return null;
  const d = new Date(classTask.date + 'T12:00:00'); // avoid UTC shift
  const plan = planTrip(classTask.time, d.getDay(), cfg);
  if (!plan || plan.noService || plan.tooLate) return null;
  const shortTitle = classTask.title.length > 40
    ? classTask.title.slice(0, 40) + '…'
    : classTask.title;
  return {
    title: `🚌 Sair pro circular — ${shortTitle}`,
    description: `Pegue o 110 das ${plan.busDeparture} (chega Unicamp ${plan.arriveCampusAt}, chega aula ${plan.arriveClassAt}).`,
    time: plan.leaveHomeAt,
    date: classTask.date,
    category: 'casa',   // reminders belong to the home routine bucket
    effort: '10',       // short prep + walk
    done: false,
    recurring: false,
    plan,
  };
}
