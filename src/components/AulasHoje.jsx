import { useState } from 'react';
import { getDateKey, setAttendance as setAttendanceDb, deleteAttendance as deleteAttendanceDb, attendanceSummary } from '../store';
import { attendanceLevel, aulasRestantes } from '../lib/attendance';
import { GraduationCap, Check, X } from 'lucide-react';

// Today's classes (from each subject's class_schedule) with presente/faltei.
// Renders nothing when no class is scheduled for today.
export default function AulasHoje({ state, updateState, userId }) {
  // O push de presenca abre o app em /?presenca=<subjectId>. Destacamos a
  // materia perguntada e limpamos a URL, pra o destaque nao grudar.
  const [perguntada, setPerguntada] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('presenca');
    if (v) window.history.replaceState({}, '', window.location.pathname);
    return v;
  });
  const today = getDateKey();
  const dow = new Date().getDay();

  const classes = [];
  for (const s of state.subjects || []) {
    if (s.attends === false) continue;   // nao frequenta: nao pergunta presenca
    for (const slot of s.class_schedule || []) {
      if (slot.day === dow) classes.push({ subjectId: s.id, label: s.code || s.name, time: slot.time || '', room: slot.room || '', subject: s });
    }
  }
  classes.sort((a, b) => a.time.localeCompare(b.time));
  if (!classes.length) return null;

  const statusOf = (subjectId) =>
    (state.attendance || []).find(a => a.subjectId === subjectId && a.date === today)?.status;

  const mark = (subjectId, status) => {
    if (perguntada === subjectId) setPerguntada(null);
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
      {perguntada && (
        <p className="text-[12px] text-indigo-300 bg-indigo-500/10 rounded-lg px-3 py-2 mb-3">
          Voce foi nessa aula? Marque abaixo. Aula nao marcada nao entra na conta dos 75%.
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        {classes.map(c => {
          const st = statusOf(c.subjectId);
          return (
            <div key={c.subjectId + c.time}
              className={`card-inner !p-3 flex items-center gap-3 border-l-2 ${
                perguntada === c.subjectId ? 'ring-1 ring-indigo-500/60 ' : ''}${{
                ok: 'border-l-zinc-700', atencao: 'border-l-amber-500',
                perigo: 'border-l-orange-500', estourado: 'border-l-red-500',
              }[attendanceLevel(attendanceSummary(c.subject, state.attendance, state.settings, today))]}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white truncate">{c.label}</p>
                <p className="text-[11px] text-zinc-500">{c.time}{c.room ? ` · ${c.room}` : ''}</p>
                {(() => {
                  // Quanto de falta ja foi e quanto ainda cabe, do lado da
                  // decisao de ir ou nao ir. Numero longe da decisao nao decide.
                  const a = attendanceSummary(c.subject, state.attendance, state.settings, today);
                  if (!a.maxMisses) return null;
                  const nivel = attendanceLevel(a);
                  const sobram = aulasRestantes(a);
                  const cor = {
                    ok: 'text-zinc-500', atencao: 'text-amber-400',
                    perigo: 'text-orange-400', estourado: 'text-red-400',
                  }[nivel];
                  const txt = nivel === 'estourado'
                    ? 'limite estourado'
                    : `faltou ${a.absences}h de ${a.maxMisses}h · pode perder ${Math.floor(sobram)} aula${Math.floor(sobram) === 1 ? '' : 's'}`;
                  return (
                    <p className={`text-[11px] mt-1 font-medium ${cor}`}>
                      {nivel !== 'ok' && <span aria-hidden="true">▲ </span>}{txt}
                    </p>
                  );
                })()}
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
