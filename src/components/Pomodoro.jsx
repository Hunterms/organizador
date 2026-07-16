import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getDateKey, getSubjectStudyStats,
  createStudySession as createStudySessionDb,
  updateTopic as updateTopicDb,
  updateTask as updateTaskDb,
} from '../store';
import { Play, Pause, SkipForward, RotateCcw, Timer, TrendingUp } from 'lucide-react';

const PHASES = { FOCUS: 'focus', SHORT_BREAK: 'short_break', LONG_BREAK: 'long_break' };
const phaseLabels = { focus: 'Foco', short_break: 'Pausa curta', long_break: 'Pausa longa' };
const phaseColors = { focus: '#6366f1', short_break: '#22c55e', long_break: '#06b6d4' };

export default function Pomodoro({ state, updateState, userId, preselectKey, onPreselectConsumed }) {
  const { pomodoroSettings: settings } = state;
  // The target of the Pomodoro can be a topic (study), a kanban card (work),
  // or any pending task. Serialized as a single string key so the native
  // <select> can handle it; parsed back to an object when reading.
  const [selectedKey, setSelectedKey] = useState('');
  // Picker tab: tarefa | trabalho | estudo. Starts on whichever tab has
  // items so the user doesn't land on an empty view.
  const [activeTab, setActiveTab] = useState('tarefa');
  const [phase, setPhase] = useState(PHASES.FOCUS);
  const [timeLeft, setTimeLeft] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef(null);

  const phaseDuration = phase === PHASES.FOCUS
    ? settings.focusDuration * 60
    : phase === PHASES.SHORT_BREAK
    ? settings.shortBreak * 60
    : settings.longBreak * 60;

  const progress = ((phaseDuration - timeLeft) / phaseDuration) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // ---- Unified focus-target picker ---------------------------------------
  // Build the union of things the user can focus on. Each option exposes a
  // stable `key` for the <select>, plus the fields we need to log a session.
  const focusOptions = useMemo(() => {
    const today = getDateKey();
    const out = { topics: [], kanban: [], tasks: [] };
    // 1. Study topics. Subjects the user dismissed are already filtered out
    // upstream in fetchAllData — so "Paradigmas" (after delete) won't show.
    for (const subject of state.subjects || []) {
      for (const topic of subject.topics || []) {
        if (!topic.id) continue;
        out.topics.push({
          key: `topic|${subject.id}|${topic.id}`,
          label: `${subject.name} — ${topic.name}`,
          subjectId: subject.id,
          topicName: topic.name,
          kind: 'topic',
        });
      }
    }
    // 2. Open work items (To Do / Doing only — finished cards don't need a Pomodoro)
    for (const col of ['todo', 'doing']) {
      for (const card of (state.kanban?.[col] || [])) {
        out.kanban.push({
          key: `kanban|${card.id}`,
          label: card.project ? `[${card.project}] ${card.title}` : card.title,
          topicName: card.project ? `🧰 ${card.project}: ${card.title}` : `🧰 ${card.title}`,
          kind: 'kanban',
          colName: col,
        });
      }
    }
    // 3. Pending tasks — only today or future, never past ones (those are
    // dead weight in the picker; if the user didn't do them by now, a
    // Pomodoro won't help).
    for (const task of state.tasks || []) {
      if (task.done) continue;
      if (task.date && task.date < today) continue;
      out.tasks.push({
        key: `task|${task.id}`,
        label: `${task.category}: ${task.title}${task.date === today ? '' : ` · ${task.date}`}${task.required_pomodoros ? ` · 🍅 ${task.pomodoros_done || 0}/${task.required_pomodoros}` : ''}`,
        topicName: `✅ ${task.category}: ${task.title}`,
        kind: 'task',
        taskId: task.id,
        date: task.date,
      });
    }
    // Sort tasks: today first, then upcoming
    out.tasks.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return out;
  }, [state.subjects, state.kanban, state.tasks]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return [...focusOptions.topics, ...focusOptions.kanban, ...focusOptions.tasks]
      .find(o => o.key === selectedKey) || null;
  }, [selectedKey, focusOptions]);

  // Today's sessions
  const todaySessions = useMemo(() => {
    const today = getDateKey();
    return (state.studySessions || []).filter(s => s.date === today && s.type === 'focus');
  }, [state.studySessions]);

  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0);

  // Per-topic stats for the currently-selected STUDY subject (only)
  const subjectStats = useMemo(() => {
    if (selected?.kind !== 'topic') return null;
    return getSubjectStudyStats(state.studySessions || [], selected.subjectId);
  }, [state.studySessions, selected]);
  const selectedSubjectName = selected?.kind === 'topic'
    ? state.subjects.find(s => s.id === selected.subjectId)?.name
    : null;

  // Apply a focus target handed over from Hoje (a pomodoro-gated task).
  useEffect(() => {
    if (preselectKey) {
      setSelectedKey(preselectKey);
      setActiveTab('tarefa');
      onPreselectConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectKey]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            handlePhaseComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const handlePhaseComplete = () => {
    setIsRunning(false);

    // Notify
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(phase === PHASES.FOCUS ? 'Pausa!' : 'Hora de focar!', {
        body: phase === PHASES.FOCUS
          ? `${settings.focusDuration}min de foco completos!`
          : 'Pausa terminou. Vamos voltar!',
      });
    }

    // Log focus session
    if (phase === PHASES.FOCUS && selected) {
      const tmpId = 'tmp-' + Date.now();
      const session = {
        id: tmpId,
        subjectId: selected.kind === 'topic' ? selected.subjectId : null,
        topicName: selected.topicName || 'Geral',
        duration: settings.focusDuration,
        date: getDateKey(),
        type: 'focus',
      };
      updateState(prev => {
        const sessions = [...(prev.studySessions || []), session];
        // Only bump local topic.totalStudyMinutes when focusing on a real topic
        const subjects = selected.kind === 'topic'
          ? prev.subjects.map(s => {
              if (s.id !== selected.subjectId) return s;
              return {
                ...s,
                topics: s.topics.map(t => {
                  if (t.name !== selected.topicName) return t;
                  return {
                    ...t,
                    totalStudyMinutes: (t.totalStudyMinutes || 0) + settings.focusDuration,
                    lastStudied: getDateKey(),
                  };
                }),
              };
            })
          : prev.subjects;
        return { ...prev, studySessions: sessions, subjects };
      });

      // Persist the session. If it was on a real topic, also bump the topic's
      // server-side totalStudyMinutes so stats survive reload.
      if (userId) {
        createStudySessionDb(userId, session)
          .then(saved => {
            updateState(p => ({
              ...p,
              studySessions: (p.studySessions || []).map(s => s.id === tmpId ? { ...s, id: saved.id } : s),
            }));
          })
          .catch(e => console.error('pomodoro session sync failed:', e));

        if (selected.kind === 'topic') {
          const subj = state.subjects.find(s => s.id === selected.subjectId);
          const topic = subj?.topics.find(t => t.name === selected.topicName);
          const topicIdValid = topic?.id && !(typeof topic.id === 'string' && topic.id.startsWith('tmp-'));
          if (topicIdValid) {
            const newMinutes = (topic.totalStudyMinutes || 0) + settings.focusDuration;
            updateTopicDb(topic.id, {
              totalStudyMinutes: newMinutes,
              lastStudied: getDateKey(),
            }).catch(e => console.error('pomodoro topic sync failed:', e));
          }
        }
      }

      // Pomodoro-gated task: count this focus toward the task's requirement.
      if (selected.kind === 'task' && selected.taskId) {
        const tid = selected.taskId;
        const cur = state.tasks.find(t => t.id === tid);
        const nextDone = (cur?.pomodoros_done || 0) + 1;
        updateState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === tid ? { ...t, pomodoros_done: nextDone } : t) }));
        if (userId && !(typeof tid === 'string' && tid.startsWith('tmp-'))) {
          updateTaskDb(tid, { pomodoros_done: nextDone }).catch(e => console.error('pomodoro task increment failed:', e));
        }
      }

      const newSessions = sessionsCompleted + 1;
      setSessionsCompleted(newSessions);

      // Decide next phase
      if (newSessions % settings.sessionsBeforeLong === 0) {
        setPhase(PHASES.LONG_BREAK);
        setTimeLeft(settings.longBreak * 60);
      } else {
        setPhase(PHASES.SHORT_BREAK);
        setTimeLeft(settings.shortBreak * 60);
      }
    } else {
      // Break is over, back to focus
      setPhase(PHASES.FOCUS);
      setTimeLeft(settings.focusDuration * 60);
    }
  };

  const toggleTimer = () => {
    if (!isRunning && phase === PHASES.FOCUS && !selected) return;

    if (!isRunning && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setIsRunning(!isRunning);
  };

  const skipPhase = () => {
    setIsRunning(false);
    if (phase === PHASES.FOCUS) {
      setPhase(PHASES.SHORT_BREAK);
      setTimeLeft(settings.shortBreak * 60);
    } else {
      setPhase(PHASES.FOCUS);
      setTimeLeft(settings.focusDuration * 60);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setPhase(PHASES.FOCUS);
    setTimeLeft(settings.focusDuration * 60);
    setSessionsCompleted(0);
  };

  const strokeColor = phaseColors[phase];
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="section-gap animate-in">
      {/* Timer */}
      <div className="card flex flex-col items-center py-12">
        <span className={`inline-flex items-center text-[11px] font-semibold tracking-wide uppercase px-4 py-2 rounded-full mb-10 whitespace-nowrap ${
          phase === PHASES.FOCUS ? 'bg-indigo-500/20 text-indigo-400' :
          phase === PHASES.SHORT_BREAK ? 'bg-green-500/20 text-green-400' :
          'bg-cyan-500/20 text-cyan-400'
        }`}>
          {phaseLabels[phase]}
        </span>

        <div className={`relative w-48 h-48 ${isRunning && phase === PHASES.FOCUS ? 'timer-active' : ''}`} style={{ borderRadius: '50%' }}
          role="timer" aria-live="polite" aria-atomic="true"
          aria-label={`${phaseLabels[phase]}: ${String(minutes).padStart(2,'0')} minutos e ${String(seconds).padStart(2,'0')} segundos restantes`}>
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#27272a" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={strokeColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold text-white tracking-tight tabular-nums leading-none">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
            {selected && (
              <span className="text-[11px] text-zinc-500 mt-3 max-w-[150px] truncate text-center">
                {selected.label}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 mt-12">
          <button
            onClick={resetTimer}
            aria-label="Resetar timer"
            className="w-12 h-12 rounded-full bg-[#27272a] hover:bg-[#3f3f46] flex items-center justify-center transition-colors"
          >
            <RotateCcw size={16} className="text-zinc-400" aria-hidden="true" />
          </button>

          <button
            onClick={toggleTimer}
            disabled={phase === PHASES.FOCUS && !selected}
            aria-label={isRunning ? 'Pausar timer' : 'Iniciar timer'}
            aria-pressed={isRunning}
            className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-colors ${
              phase === PHASES.FOCUS && !selected
                ? 'bg-zinc-700 opacity-30 cursor-not-allowed'
                : isRunning
                ? 'bg-red-500 hover:bg-red-400'
                : 'bg-indigo-500 hover:bg-indigo-400'
            }`}
          >
            {isRunning ? <Pause size={26} className="text-white" aria-hidden="true" /> : <Play size={26} className="text-white ml-1" aria-hidden="true" />}
          </button>

          <button
            onClick={skipPhase}
            aria-label="Pular fase"
            className="w-12 h-12 rounded-full bg-[#27272a] hover:bg-[#3f3f46] flex items-center justify-center transition-colors"
          >
            <SkipForward size={16} className="text-zinc-400" aria-hidden="true" />
          </button>
        </div>

        {/* Session counter */}
        <div className="flex items-center gap-2.5 mt-10">
          {Array.from({ length: settings.sessionsBeforeLong }, (_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                i < (sessionsCompleted % settings.sessionsBeforeLong)
                  ? 'bg-indigo-500'
                  : 'bg-zinc-700'
              }`}
            />
          ))}
          <span className="text-[11px] text-zinc-500 ml-2">{sessionsCompleted} sessoes</span>
        </div>
      </div>

      {/* Focus target — below the timer so the timer stays in view */}
      <div className="card space-y-4">
        <p className="text-xs font-medium text-zinc-400">No que voce vai focar</p>
        <div className="flex gap-1 bg-zinc-800/40 p-1 rounded-xl">
          {[
            { id: 'tarefa', label: 'Tarefa', icon: '✅', count: focusOptions.tasks.length },
            { id: 'estudo', label: 'Estudo', icon: '📚', count: focusOptions.topics.length },
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={active}
                className={`flex-1 min-h-[40px] rounded-lg text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5 ${active ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <span aria-hidden="true">{tab.icon}</span>
                {tab.label}
                {tab.count > 0 && (<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-500/30' : 'bg-zinc-700/60'}`}>{tab.count}</span>)}
              </button>
            );
          })}
        </div>
        <div className="max-h-[240px] overflow-y-auto flex flex-col gap-1.5 pr-1">
          {(() => {
            const list = activeTab === 'estudo' ? focusOptions.topics : focusOptions.tasks;
            if (list.length === 0) {
              return (
                <p className="text-[11px] text-zinc-600 text-center py-6 leading-relaxed">
                  {activeTab === 'estudo' ? 'Nenhum topico cadastrado. Adicione materias em Estudos.' : 'Nenhuma tarefa pendente de hoje ou futura. Adicione no Hoje.'}
                </p>
              );
            }
            return list.map(o => {
              const sel = selectedKey === o.key;
              return (
                <button key={o.key} onClick={() => setSelectedKey(sel ? '' : o.key)} aria-pressed={sel}
                  className={`text-left px-3 py-2.5 rounded-lg text-[13px] transition-colors min-h-[44px] ${sel ? 'bg-indigo-500/20 text-indigo-100 ring-1 ring-indigo-500/50' : 'bg-zinc-800/40 text-zinc-200 hover:bg-zinc-800'}`}>
                  <span className="block truncate">{o.label}</span>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* Today's study stats */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <TrendingUp size={14} className="text-indigo-400" /> Estudo de hoje
          </p>
          <span className="text-xs text-zinc-500">
            {Math.floor(todayMinutes / 60)}h{todayMinutes % 60}m total
          </span>
        </div>

        {todaySessions.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-3">Nenhuma sessao hoje. Comece um Pomodoro!</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(
              todaySessions.reduce((acc, s) => {
                const key = `${s.subjectId}|${s.topicName}`;
                acc[key] = (acc[key] || { ...s, duration: 0 });
                acc[key].duration += s.duration;
                return acc;
              }, {})
            ).map(([key, session]) => {
              const subj = state.subjects.find(s => s.id === session.subjectId);
              // Sessions without a subjectId came from Kanban/Task focus; show
              // a neutral label and let topicName carry the detail.
              const primary = subj?.name || (session.topicName?.startsWith('🧰')
                ? 'Trabalho'
                : session.topicName?.startsWith('✅') ? 'Tarefa' : 'Outro');
              return (
                <div key={key} className="card-inner !p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white">{primary}</p>
                    <p className="text-[10px] text-zinc-500">{session.topicName}</p>
                  </div>
                  <span className="text-xs font-medium text-indigo-400">{session.duration}min</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Per-topic breakdown — only shown when user is focused on a study topic */}
      {subjectStats && subjectStats.sessionCount > 0 && (
        <div className="card">
          <p className="text-sm font-medium text-white mb-3">
            Tempo por topico - {selectedSubjectName}
          </p>
          <div className="space-y-2">
            {Object.entries(subjectStats.topicMinutes)
              .sort((a, b) => b[1] - a[1])
              .map(([topic, mins]) => {
                const maxMins = Math.max(...Object.values(subjectStats.topicMinutes));
                const pct = (mins / maxMins) * 100;
                return (
                  <div key={topic}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-300 truncate">{topic}</span>
                      <span className="text-zinc-500 ml-2">{mins}min</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${topic}: ${mins}min`}>
                      <div className="h-full bg-indigo-500 rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
