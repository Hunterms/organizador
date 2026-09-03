import { useMemo } from 'react';
import { X, Flame, Shield, Zap, Timer, GraduationCap, Trophy,
  CheckCircle2, PlayCircle, XCircle } from 'lucide-react';
import { computeStats, dailyActivity } from '../lib/gamification';
import { aderencia, horariosQueRendem } from '../lib/aderencia';
import { retornoPorMateria } from '../lib/retorno';
import { getDateKey } from '../store';

// Evolution over time — builds self-efficacy: streak + best, shields, level,
// accumulated focus, mastery, and a per-day activity chart.
export default function Progresso({ state, onClose }) {
  const stats = useMemo(() => computeStats(state), [state]);
  const activity = useMemo(() => dailyActivity(state, 21), [state]);
  const hoje = getDateKey();
  const ader = useMemo(() => aderencia(state.tasks, hoje), [state.tasks, hoje]);
  const horarios = useMemo(() => horariosQueRendem(state.tasks, hoje), [state.tasks, hoje]);
  const retorno = useMemo(() => retornoPorMateria(state.subjects, state.tasks),
    [state.subjects, state.tasks]);

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
            <span className="text-[12px] text-zinc-400">· {stats.ativos30} dias ativos em 30</span>
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

        {/* Aderencia: quanto do plano vira trabalho, e onde ele morre.
            O canon otimiza o VALOR do bloco de 50min e nunca mediu a
            PROBABILIDADE de ele comecar. Steel (2007) poe aversao a tarefa entre
            os preditores mais fortes de procrastinacao, e aversao nao se resolve
            escalonando melhor. O veredito abaixo foi escrito ANTES de ver o
            numero, pra nao virar interpretacao conveniente depois. */}
        {ader.baseSuficiente && (
          <div className="card space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-white">Aderencia ao plano</p>
              <span className="text-[10px] text-zinc-600">{ader.total} blocos, 4 semanas</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat Icon={CheckCircle2} color="text-emerald-400"
                value={`${Math.round(ader.taxa * 100)}%`} label="fechados" />
              <Stat Icon={PlayCircle} color="text-amber-400"
                value={`${Math.round(ader.taxaAparecimento * 100)}%`} label="apareceu" />
              <Stat Icon={XCircle} color="text-zinc-500"
                value={ader.intocados} label="nem abriu" />
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {ader.veredito === 'canon' && (
                <>Voce fecha o que planeja. O bloco de 50min esta certo do jeito
                que esta, e o gargalo nao e aversao.</>
              )}
              {ader.veredito === 'aversao' && (
                <>Menos da metade fecha, e o modo de falha e <span className="text-zinc-200">
                {ader.modoDeFalha}</span>. Bloco de 50min que nao comeca vale zero:
                um pomodoro so ja segura o dia.</>
              )}
              {ader.veredito === 'indefinido' && (
                <>Entre 50% e 75%. Nao decide nada ainda: nem absolve o bloco de
                50min nem acusa aversao.</>
              )}
            </p>
            {horarios && horarios.melhor.taxa > horarios.pior.taxa && (
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Voce fecha {Math.round(horarios.melhor.taxa * 100)}% dos blocos das{' '}
                <span className="text-zinc-300">{horarios.melhor.hora}h</span> e{' '}
                {Math.round(horarios.pior.taxa * 100)}% dos das{' '}
                <span className="text-zinc-300">{horarios.pior.hora}h</span>.
              </p>
            )}
          </div>
        )}

        {/* Retorno: hora que entrou contra nota que saiu. Sem coeficiente e sem
            causalidade de proposito: sao ~17 notas no semestre, com professor e
            dificuldade diferentes. Serve pra flagrar descasamento grosso. */}
        {retorno.some(l => l.minutos > 0 || l.lancadas > 0) && (
          <div className="card space-y-3">
            <p className="text-sm font-medium text-white">Hora que entrou, nota que saiu</p>
            <div className="space-y-1.5">
              {retorno.filter(l => l.minutos > 0 || l.lancadas > 0).map(l => (
                <div key={l.subjectId}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    l.atencao ? 'bg-red-500/10 border border-red-500/20'
                      : l.rendendo ? 'bg-emerald-500/[0.07]' : 'bg-zinc-800/40'}`}>
                  <span className="text-[11px] text-zinc-400 w-14 shrink-0">{l.code}</span>
                  <span className="text-[12px] text-zinc-200 tabular-nums w-16 shrink-0">
                    {l.horas}h
                  </span>
                  <span className="text-[12px] tabular-nums flex-1 text-right">
                    {l.lancadas === 0
                      ? <span className="text-zinc-600">sem nota</span>
                      : <span className={(l.media ?? l.mediaSimples) < 5 ? 'text-red-300' : 'text-emerald-300'}>
                          {l.media ?? l.mediaSimples}
                        </span>}
                  </span>
                  <span className="text-[10px] text-zinc-600 w-10 text-right shrink-0">
                    {l.lancadas}/{l.avaliacoes}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Hora conta so bloco fechado. Nota usa a formula da materia quando
              ela existe. Vermelho e hora acima da mediana com media abaixo de 5.
              Nao e correlacao: n e pequeno demais pra isso.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
