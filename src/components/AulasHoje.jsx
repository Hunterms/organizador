import { getDateKey, setAttendance as setAttendanceDb, deleteAttendance as deleteAttendanceDb } from '../store';
import { GraduationCap, Check, X } from 'lucide-react';

// Today's classes (from each subject's class_schedule) with presente/faltei.
// Renders nothing when no class is scheduled for today.
export default function AulasHoje({ state, updateState, userId }) {
  const today = getDateKey();
  const dow = new Date().getDay();

  const classes = [];
  for (const s of state.subjects || []) {
    for (const slot of s.class_schedule || []) {
      if (slot.day === dow) classes.push({ subjectId: s.id, label: s.code || s.name, time: slot.time || '', room: slot.room || '' });
    }
  }
  classes.sort((a, b) => a.time.localeCompare(b.time));
  if (!classes.length) return null;

  const statusOf = (subjectId) =>
    (state.attendance || []).find(a => a.subjectId === subjectId && a.date === today)?.status;

  const mark = (subjectId, status) => {
    const cur = statusOf(subjectId);
    const isTmp = (id) => typeof id === 'string' && id.startsWith('tmp-');
    if (cur === status) {
      updateState(p => ({ ...p, attendance: (p.attendance || []).filter(a => !(a.subjectId === subjectId && a.date === today)) }));
      if (userId) deleteAttendanceDb(userId, subjectId, today).catch(e => console.error('attendance delete failed:', e));
      return;
    }
    updateState(p => {
      const others = (p.attendance || []).filter(a => !(a.subjectId === subjectId && a.date === today));
      return { ...p, attendance: [...others, { id: 'tmp-' + Date.now(), subjectId, date: today, status }] };
    });
    if (userId) setAttendanceDb(userId, subjectId, today, status)
      .then(saved => updateState(p => ({
        ...p,
        attendance: (p.attendance || []).map(a => (a.subjectId === subjectId && a.date === today && isTmp(a.id)) ? { ...a, id: saved.id } : a),
      })))
      .catch(e => console.error('attendance save failed:', e));
  };

  return (
    <div className="card">
      <p className="text-sm font-medium text-white flex items-center gap-2 mb-4">
        <GraduationCap size={15} className="text-cyan-400" aria-hidden="true" /> Aulas de hoje
      </p>
      <div className="flex flex-col gap-2.5">
        {classes.map(c => {
          const st = statusOf(c.subjectId);
          return (
            <div key={c.subjectId + c.time} className="card-inner !p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white truncate">{c.label}</p>
                <p className="text-[11px] text-zinc-500">{c.time}{c.room ? ` · ${c.room}` : ''}</p>
              </div>
              <button onClick={() => mark(c.subjectId, 'present')} aria-pressed={st === 'present'}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  st === 'present' ? 'bg-green-500/25 text-green-300 ring-1 ring-green-500/50' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                }`}>
                <Check size={13} aria-hidden="true" /> Fui
              </button>
              <button onClick={() => mark(c.subjectId, 'absent')} aria-pressed={st === 'absent'}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  st === 'absent' ? 'bg-red-500/25 text-red-300 ring-1 ring-red-500/50' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                }`}>
                <X size={13} aria-hidden="true" /> Faltei
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
