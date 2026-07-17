import { useMemo } from 'react';
import { X, Flame, Shield, Zap, Timer, GraduationCap, Trophy } from 'lucide-react';
import { computeStats, dailyActivity } from '../lib/gamification';
import { getDateKey } from '../store';

// Evolution over time — builds self-efficacy: streak + best, shields, level,
// accumulated focus, mastery, and a per-day activity chart.
export default function Progresso({ state, onClose }) {
  const stats = useMemo(() => computeStats(state), [state]);
  const activity = useMemo(() => dailyActivity(state, 21), [state]);

  const extra = useMemo(() => {
    const focus = (state.studySessions || []).filter(s => s.type === 'focus');
    const totalMin = focus.reduce((a, s) => a + (s.duration || 0), 0);
    const weekAgo = getDateKey(new Date(Date.now() - 6 * 86400000));
    const weekMin = focus.filter(s => s.date >= weekAgo).reduce((a, s) => a + (s.duration || 0), 0);
    let mastered = 0, topics = 0;
    for (const s of state.subjects || []) for (const t of s.topics || []) { topics++; if (t.status === 'mastered') mastered++; }
    const activeDays = activity.filter(a => a.kept).length;
    return { totalH: (totalMin / 60).toFixed(1), weekMin, mastered, topics, activeDays };
  }, [state, activity]);

  const maxPomo = Math.max(3, ...activity.map(a => a.pomodoros));

  const Stat = ({ Icon, color, value, label }) => (
    <div className="card-inner flex flex-col gap-1">
      <Icon size={15} className={color} aria-hidden="true" />
      <span className="text-lg font-bold text-white tabular-nums leading-none mt-1">{value}</span>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col animate-in">
      <div className="page-x pb-4 flex items-center gap-3 border-b border-zinc-800/50 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}>
        <button onClick={onClose} aria-label="Voltar" className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white rounded-xl -ml-2"><X size={20} /></button>
        <h2 className="text-base font-semibold text-white">Progresso</h2>
      </div>

      <div className="flex-1 overflow-y-auto page-x pt-5 pb-10 section-gap">
        {/* Streak + shields */}
        <div className="card flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Flame size={26} className={stats.streak > 0 ? 'text-orange-400' : 'text-zinc-700'} aria-hidden="true" />
            <div className="leading-none">
              <p className="text-3xl font-bold text-white tabular-nums">{stats.streak}</p>
              <p className="text-[11px] text-zinc-500 mt-1">sequencia</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-end gap-1.5">
            <span className="text-[12px] text-zinc-400 flex items-center gap-1.5"><Trophy size={12} className="text-amber-400" aria-hidden="true" /> recorde {stats.best}</span>
            <span className="text-[12px] text-zinc-400 flex items-center gap-1.5">
              <Shield size={12} className="text-cyan-400" aria-hidden="true" />
              {stats.shieldsLeft}/2 escudos este mes
            </span>
          </div>
        </div>
        {stats.atRisk && (
          <p className="text-[11px] text-orange-300/80 bg-orange-500/10 rounded-lg px-3 py-2 -mt-2">
            Hoje ainda nao conta. Faz 1 pomodoro ou 80% das tarefas pra manter (ou um escudo salva).
          </p>
        )}

        {/* Level */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-indigo-300 flex items-center gap-1.5"><Zap size={14} aria-hidden="true" /> Nivel {stats.level}</span>
            <span className="text-[11px] text-zinc-500 tabular-nums">{stats.xpIntoLevel}/{stats.xpForNext} XP</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, stats.levelProgress * 100)}%` }} />
          </div>
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-2 gap-3">
          <Stat Icon={Timer} color="text-amber-400" value={`${extra.totalH}h`} label="foco acumulado" />
          <Stat Icon={Timer} color="text-amber-400" value={`${Math.floor(extra.weekMin / 60)}h${extra.weekMin % 60}m`} label="foco esta semana" />
          <Stat Icon={GraduationCap} color="text-violet-400" value={`${extra.mastered}/${extra.topics}`} label="topicos dominados" />
          <Stat Icon={Flame} color="text-orange-400" value={extra.activeDays} label="dias ativos (21d)" />
        </div>

        {/* Activity chart */}
        <div className="card">
          <p className="text-sm font-medium text-white mb-4">Ultimos 21 dias</p>
          <div className="flex items-end gap-1 h-24">
            {activity.map((a) => (
              <div key={a.date} className="flex-1 flex flex-col justify-end items-center gap-1" title={`${a.date}: ${a.pomodoros} pomodoro(s)`}>
                <div className={`w-full rounded-sm ${a.kept ? 'bg-indigo-500' : 'bg-zinc-800'}`}
                  style={{ height: `${Math.max(4, (a.pomodoros / maxPomo) * 100)}%`, minHeight: 4 }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-500" /> dia mantido</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-800" /> parado</span>
            <span className="ml-auto">altura = pomodoros</span>
          </div>
        </div>
      </div>
    </div>
  );
}
