import { useState, useMemo } from 'react';
import {
  getDateKey, classDates, attendanceSummary,
  setAttendance as setAttendanceDb, deleteAttendance as deleteAttendanceDb,
  setAttendanceBulk, updateProfile as updateProfileDb,
} from '../store';
import { attendanceLevel, aulasRestantes } from '../lib/attendance';
import { X, Check, CalendarRange, Loader2, AlertTriangle } from 'lucide-react';

const weekday = d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtH = h => (Number.isInteger(h) ? h : h.toFixed(1)) + 'h';

// Recuperar presenca de qualquer dia passado. O AulasHoje so marca hoje; quando
// voce some por umas semanas, nao existe caminho pra contar o que aconteceu.
export default function Presenca({ state, updateState, userId, onClose }) {
  const [showMarked, setShowMarked] = useState(false);
  const [bulkUntil, setBulkUntil] = useState(getDateKey());
  const [busy, setBusy] = useState(false);

  const today = getDateKey();
  const { semesterStart = '', semesterEnd = '' } = state.settings || {};
  const subjects = (state.subjects || []).filter(s => s.attends !== false && (s.class_schedule || []).length);

  const setDates = (patch) => {
    updateState(p => ({ ...p, settings: { ...p.settings, ...patch } }));
    if (userId) updateProfileDb(userId, patch).catch(e => console.error('semester sync failed:', e));
  };

  // Toda aula passada de todas as materias, mais recente primeiro.
  const rows = useMemo(() => {
    if (!semesterStart || !semesterEnd) return [];
    const out = [];
    for (const s of subjects) {
      for (const c of classDates(s, semesterStart, semesterEnd)) {
        if (c.date > today) continue;
        out.push({ ...c, subjectId: s.id, label: s.code || s.name });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
  }, [subjects, semesterStart, semesterEnd, today]);

  const statusOf = (subjectId, date) =>
    (state.attendance || []).find(a => a.subjectId === subjectId && a.date === date)?.status;

  const visible = showMarked ? rows : rows.filter(r => !statusOf(r.subjectId, r.date));
  const pending = rows.filter(r => !statusOf(r.subjectId, r.date));

  const mark = (subjectId, date, status) => {
    const cur = statusOf(subjectId, date);
    if (cur === status) {
      updateState(p => ({ ...p, attendance: (p.attendance || []).filter(a => !(a.subjectId === subjectId && a.date === date)) }));
      if (userId) deleteAttendanceDb(userId, subjectId, date).catch(e => console.error('attendance delete failed:', e));
      return;
    }
    updateState(p => ({
      ...p,
      attendance: [...(p.attendance || []).filter(a => !(a.subjectId === subjectId && a.date === date)),
        { id: 'tmp-' + Date.now(), subjectId, date, status }],
    }));
    if (userId) setAttendanceDb(userId, subjectId, date, status)
      .then(saved => updateState(p => ({
        ...p,
        attendance: (p.attendance || []).map(a =>
          (a.subjectId === subjectId && a.date === date) ? { ...a, id: saved.id } : a),
      })))
      .catch(e => console.error('attendance save failed:', e));
  };

  // O caso real: voce sumiu por semanas. Marca tudo que ficou em aberto ate a
  // data escolhida de uma vez, sem 40 toques.
  const bulkAbsent = async () => {
    const batch = pending.filter(r => r.date <= bulkUntil);
    if (!batch.length) return;
    setBusy(true);
    const rowsIn = batch.map(r => ({ subjectId: r.subjectId, date: r.date, status: 'absent' }));
    updateState(p => ({
      ...p,
      attendance: [...(p.attendance || []), ...rowsIn.map((r, i) => ({ id: 'tmp-b' + i, ...r }))],
    }));
    if (userId) {
      try {
        const saved = await setAttendanceBulk(userId, rowsIn);
        updateState(p => ({
          ...p,
          attendance: [...(p.attendance || []).filter(a => !String(a.id).startsWith('tmp-b')), ...saved],
        }));
      } catch (e) { console.error('bulk attendance failed:', e); }
    }
    setBusy(false);
  };

  const bulkCount = pending.filter(r => r.date <= bulkUntil).length;

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col animate-in">
      <div className="page-x pb-4 flex items-center gap-3 border-b border-zinc-800/50 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}>
        <button onClick={onClose} aria-label="Voltar"
          className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white rounded-xl -ml-2">
          <X size={20} />
        </button>
        <h2 className="text-base font-semibold text-white">Presenca</h2>
      </div>

      <div className="flex-1 overflow-y-auto page-x pt-5 pb-10 section-gap">
        {/* Datas do semestre — sem elas nao da pra saber quais aulas ja passaram */}
        <div className="card">
          <p className="text-sm font-medium text-white flex items-center gap-2 mb-1">
            <CalendarRange size={15} className="text-cyan-400" aria-hidden="true" /> Semestre
          </p>
          <p className="text-[11px] text-zinc-600 leading-relaxed mb-4">
            O total de horas-aula e o limite de 25% saem daqui. Sem as datas, tudo vira chute.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] text-zinc-500">Comeco
              <input type="date" value={semesterStart} onChange={e => setDates({ semesterStart: e.target.value })}
                className="input-base mt-1 text-[13px]" aria-label="Inicio do semestre" />
            </label>
            <label className="text-[11px] text-zinc-500">Fim
              <input type="date" value={semesterEnd} onChange={e => setDates({ semesterEnd: e.target.value })}
                className="input-base mt-1 text-[13px]" aria-label="Fim do semestre" />
            </label>
          </div>
        </div>

        {!semesterStart || !semesterEnd ? (
          <div className="card flex items-start gap-3">
            <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] text-zinc-400 leading-relaxed">
              Preencha as duas datas acima pra eu listar as aulas que ja aconteceram.
            </p>
          </div>
        ) : (
          <>
            {/* Onde voce esta, por materia */}
            <div className="card">
              <p className="text-sm font-medium text-white mb-4">Quanto ainda cabe</p>
              <div className="flex flex-col gap-3">
                {subjects.map(s => {
                  const a = attendanceSummary(s, state.attendance, state.settings, today);
                  const nivel = attendanceLevel(a);
                  const danger = nivel === 'perigo' || nivel === 'estourado';
                  const barra = { ok: 'bg-cyan-500', atencao: 'bg-amber-500',
                                  perigo: 'bg-orange-500', estourado: 'bg-red-500' }[nivel];
                  const texto = { ok: 'text-zinc-500', atencao: 'text-amber-400',
                                  perigo: 'text-orange-400', estourado: 'text-red-400' }[nivel];
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="text-zinc-300 font-medium">{s.code || s.name}</span>
                        <span className={`${texto} ${danger ? 'font-semibold' : ''}`}>
                          {fmtH(a.absences)} / {a.maxMisses}h · {nivel === 'estourado'
                            ? 'estourou' : `${Math.floor(aulasRestantes(a))} aulas`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden" role="progressbar"
                        aria-valuenow={Math.round(a.absences)} aria-valuemin={0} aria-valuemax={a.maxMisses}>
                        <div className={`h-full rounded-full transition-[width] ${barra}`}
                          style={{ width: `${a.maxMisses ? Math.min(100, (a.absences / a.maxMisses) * 100) : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recuperar um periodo inteiro de uma vez */}
            {pending.length > 0 && (
              <div className="card !bg-red-500/5 !border-red-500/20">
                <p className="text-[13px] font-semibold text-red-300 mb-1">{pending.length} aulas em aberto</p>
                <p className="text-[11px] text-red-400/70 leading-relaxed mb-4">
                  Marca tudo que ficou pra tras como falta ate a data escolhida. Depois so corrige as que voce foi.
                </p>
                <div className="flex gap-2">
                  <input type="date" value={bulkUntil} max={today} onChange={e => setBulkUntil(e.target.value)}
                    className="input-base text-[13px] flex-1" aria-label="Marcar falta ate" />
                  <button onClick={bulkAbsent} disabled={busy || !bulkCount}
                    className="bg-red-500/25 hover:bg-red-500/35 disabled:opacity-30 text-red-200 px-4 rounded-xl text-xs font-medium min-h-[44px] flex items-center gap-2">
                    {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : `Faltei (${bulkCount})`}
                  </button>
                </div>
              </div>
            )}

            {/* Aula por aula */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white">Aulas que ja passaram</p>
                <button onClick={() => setShowMarked(v => !v)} aria-pressed={showMarked}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 min-h-[36px] px-2">
                  {showMarked ? 'so em aberto' : 'mostrar marcadas'}
                </button>
              </div>
              {visible.length === 0 ? (
                <p className="text-[12px] text-zinc-600">Nada em aberto. Ta em dia.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {visible.map(r => {
                    const st = statusOf(r.subjectId, r.date);
                    return (
                      <div key={r.subjectId + r.date} className="card-inner !p-3 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-white truncate">{r.label} <span className="text-zinc-600">· {fmtH(r.hours)}</span></p>
                          <p className="text-[11px] text-zinc-500">{weekday(r.date)} · {r.time}{r.room ? ` · ${r.room}` : ''}</p>
                        </div>
                        <button onClick={() => mark(r.subjectId, r.date, 'present')} aria-pressed={st === 'present'} aria-label={`Fui em ${r.label} ${r.date}`}
                          className={`min-h-[40px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                            st === 'present' ? 'bg-green-500/25 text-green-300 ring-1 ring-green-500/50' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                          }`}>
                          <Check size={13} aria-hidden="true" /> Fui
                        </button>
                        <button onClick={() => mark(r.subjectId, r.date, 'absent')} aria-pressed={st === 'absent'} aria-label={`Faltei em ${r.label} ${r.date}`}
                          className={`min-h-[40px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                            st === 'absent' ? 'bg-red-500/25 text-red-300 ring-1 ring-red-500/50' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                          }`}>
                          <X size={13} aria-hidden="true" /> Faltei
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
