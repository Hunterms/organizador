import { useMemo, useState } from 'react';
import {
  getDateKey, getTodayReviews,
  updateTask as updateTaskDb, deleteTask as deleteTaskDb, dismissTask as dismissTaskDb,
} from '../store';
import { Check, Clock, Trash2, ClipboardList, BookOpen, GripVertical, Pencil, Flame, Play, Shield, ChevronRight } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { computeStats, pomodoroGated } from '../lib/gamification';
import AulasHoje from './AulasHoje';
import GuideViewer from './GuideViewer';
import Progresso from './Progresso';

// One progress ring (Tarefas / Foco / Agua).
function Ring({ pct, color, letter, label }) {
  const r = 17, c = 2 * Math.PI * r, off = c - (Math.min(100, pct) / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="22" cy="22" r={r} fill="none" stroke="#27272a" strokeWidth="4.5" />
          <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={off} className="transition-[stroke-dashoffset] duration-700 ease-out" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color }}>{letter}</span>
      </div>
      <span className="text-[10px] text-zinc-500 tabular-nums">{label}</span>
    </div>
  );
}

function GameHeader({ stats, onOpen }) {
  const { streak, atRisk, level, levelProgress, xpIntoLevel, xpForNext, rings, shieldsLeft } = stats;
  return (
    <div className="card space-y-4">
      <button onClick={onOpen} aria-label="Ver progresso" className="w-full flex items-center gap-4 text-left">
        <div className="flex items-center gap-2 shrink-0" aria-label={`Sequencia de ${streak} dias`}>
          <Flame size={22} className={streak > 0 ? 'text-orange-400' : 'text-zinc-700'} aria-hidden="true" />
          <div className="leading-none">
            <p className="text-xl font-bold text-white tabular-nums">{streak}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{streak === 1 ? 'dia' : 'dias'}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-indigo-300">Nivel {level}</span>
            <span className="text-[10px] text-zinc-500 tabular-nums">{xpIntoLevel}/{xpForNext} XP</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden" role="progressbar"
            aria-valuenow={Math.round(levelProgress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Nivel ${level}, ${Math.round(levelProgress * 100)}% pro proximo`}>
            <div className="h-full bg-indigo-500 rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.min(100, levelProgress * 100)}%` }} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span className="flex items-center gap-0.5 text-cyan-400" title="Escudos este mes" aria-label={`${shieldsLeft} escudos este mes`}>
            <Shield size={12} aria-hidden="true" /><span className="text-[11px] font-semibold tabular-nums">{shieldsLeft}</span>
          </span>
          <ChevronRight size={14} className="text-zinc-600" aria-hidden="true" />
        </div>
      </button>
      {atRisk && streak > 0 && (
        <p className="text-[11px] text-orange-300/80 bg-orange-500/10 rounded-lg px-3 py-2">Faz 1 pomodoro ou 80% das tarefas pra manter a sequencia (ou um escudo salva).</p>
      )}
      <div className="flex justify-around pt-1">
        <Ring pct={rings.tasks.pct} color="#6366f1" letter="T" label={rings.tasks.label} />
        <Ring pct={rings.focus.pct} color="#f59e0b" letter="F" label={rings.focus.label} />
        <Ring pct={rings.water.pct} color="#06b6d4" letter="A" label={rings.water.label} />
      </div>
    </div>
  );
}

const catBorder = { aula: 'border-l-cyan-500', estudos: 'border-l-violet-500', trabalho: 'border-l-blue-500', terreiro: 'border-l-green-500', pessoal: 'border-l-amber-500', casa: 'border-l-pink-500' };
const effortLabel = { '5': '5m', '10': '10m', '30': '30m', '60': '1h', '120': '2h+' };

function SortableTask({ task, onToggle, onDelete, onEdit, onFocus, onGuide }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : undefined };
  const gated = pomodoroGated(task);

  return (
    <div ref={setNodeRef} style={style}
      className={`card-sm border-l-[3px] ${catBorder[task.category] || 'border-l-zinc-700'} flex flex-col gap-2 transition-colors ${task.done ? 'opacity-40' : ''}`}>
      {/* Row 1: drag + check + title */}
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners}
          aria-label={`Arrastar tarefa ${task.title}`}
          className="drag-handle text-zinc-700 hover:text-zinc-500 shrink-0 -ml-2 min-w-[32px] min-h-[32px] flex items-center justify-center">
          <GripVertical size={14} aria-hidden="true" />
        </button>
        {gated ? (
          <div className="min-w-[32px] min-h-[32px] flex items-center justify-center shrink-0"
            title={`Faca ${task.required_pomodoros} pomodoro(s) pra concluir`}>
            <span className="px-1.5 h-[22px] rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-semibold flex items-center gap-0.5 tabular-nums">
              🍅 {task.pomodoros_done || 0}/{task.required_pomodoros}
            </span>
          </div>
        ) : (
          <button onClick={() => onToggle(task.id)}
            aria-label={task.done ? `Desmarcar ${task.title}` : `Marcar ${task.title} como feita`}
            aria-pressed={task.done}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center shrink-0 transition-colors">
            <span className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${task.done ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-700 hover:border-indigo-400'}`}>
              {task.done && <Check size={11} className="text-white" aria-hidden="true" />}
            </span>
          </button>
        )}
        <p className={`text-[13px] leading-snug flex-1 min-w-0 break-words pt-1.5 ${task.done ? 'line-through text-zinc-600' : 'text-zinc-200'}`}>{task.title}</p>
      </div>

      {/* Row 2: tags + actions */}
      <div className="flex items-center gap-1.5 flex-wrap pl-1">
        {task.time && <span className="text-[10px] text-zinc-600 flex items-center gap-0.5"><Clock size={9} aria-hidden="true" /> {task.time}</span>}
        <span className={`tag tag-${task.category} capitalize`}>{task.category}</span>
        <span className={`effort effort-${task.effort}`}>{effortLabel[task.effort] || '30m'}</span>
        <div className="ml-auto flex items-center gap-0.5">
          {task.guide_id && onGuide && (
            <button onClick={() => onGuide(task.guide_id)} aria-label={`Abrir guia de ${task.title}`}
              className="text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 min-w-[34px] min-h-[34px] flex items-center justify-center">
              <BookOpen size={14} aria-hidden="true" />
            </button>
          )}
          {gated && onFocus && (
            <button onClick={() => onFocus(task)} aria-label={`Focar em ${task.title}`}
              className="text-amber-400 hover:text-amber-300 transition-colors shrink-0 min-w-[34px] min-h-[34px] flex items-center justify-center">
              <Play size={13} aria-hidden="true" />
            </button>
          )}
          {onEdit && (
            <button onClick={() => onEdit(task)} aria-label={`Editar ${task.title}`}
              className="text-zinc-700 hover:text-indigo-400 transition-colors shrink-0 min-w-[34px] min-h-[34px] flex items-center justify-center">
              <Pencil size={13} aria-hidden="true" />
            </button>
          )}
          <button onClick={() => onDelete(task.id)} aria-label={`Deletar ${task.title}`}
            className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 min-w-[34px] min-h-[34px] flex items-center justify-center">
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Hoje({ state, updateState, userId, onEditTask, onFocusTask }) {
  const today = getDateKey();
  const stats = useMemo(() => computeStats(state), [state]);
  const [guideId, setGuideId] = useState(null);
  const [showProgress, setShowProgress] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Day strip: 3 days back → 2 weeks ahead, so you can work ahead.
  const dayStrip = useMemo(() => {
    const arr = []; const base = new Date();
    for (let i = -3; i <= 14; i++) { const d = new Date(base); d.setDate(base.getDate() + i); arr.push(d); }
    return arr;
  }, []);
  const taskCountByDate = useMemo(() => {
    const m = {}; for (const t of state.tasks) m[t.date] = (m[t.date] || 0) + 1; return m;
  }, [state.tasks]);

  const dayTasks = useMemo(() => {
    return state.tasks
      .filter(t => t.date === selectedDate)
      .sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : 0));
  }, [state.tasks, selectedDate]);

  const totalMinutes = dayTasks.filter(t => !t.done).reduce((sum, t) => sum + parseInt(t.effort || '30'), 0);
  const doneCount = dayTasks.filter(t => t.done).length;
  const todayReviews = useMemo(() => getTodayReviews(state.subjects), [state.subjects]);
  const pct = dayTasks.length > 0 ? Math.round((doneCount / dayTasks.length) * 100) : 0;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  // Optimistic update in local state, then sync to Supabase. If the sync fails
  // we log to console but keep the optimistic state — simpler UX than rolling
  // back. Skipping 'tmp-' ids (tasks still in-flight from add).
  const toggleTask = (id) => {
    // Compute the next value SYNCHRONOUSLY from the current state before
    // dispatching the setState updater. Capturing it via side-effect inside
    // the updater is unsafe — React may call the updater more than once
    // (StrictMode) or defer it, leaving `nextDone` as null when the PATCH
    // fires, which violates the NOT NULL constraint on `done`.
    const current = state.tasks.find(t => t.id === id);
    if (!current) return;
    const nextDone = !current.done;
    updateState(p => ({ ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, done: nextDone } : t) }));
    if (typeof id === 'string' && id.startsWith('tmp-')) return;
    updateTaskDb(id, { done: nextDone }).catch(e => console.error('toggleTask sync failed:', e));
  };
  const deleteTask = (id) => {
    // Decide dismiss vs hard-delete BEFORE we drop the task from state.
    // Imports (classroom / work_calendar / moodle / class) get dismissed so the
    // next sync doesn't re-create them. Manual tasks get hard-deleted.
    const task = state.tasks.find(t => t.id === id);
    const isImport = task?.source && task.source !== 'manual';
    // Cascade: if this task has a companion (e.g. the circular bus task
    // points back at an aula via companion_task_id), delete it too so we
    // don't leave an orphan reminder in the list.
    const companion = state.tasks.find(t => t.companion_task_id === id);
    const companionId = companion?.id;
    updateState(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id && t.id !== companionId) }));
    if (companionId && typeof companionId === 'string' && !companionId.startsWith('tmp-')) {
      deleteTaskDb(companionId).catch(e => console.error('companion cleanup failed:', e));
    }
    if (typeof id === 'string' && id.startsWith('tmp-')) return;
    const op = isImport ? dismissTaskDb(id) : deleteTaskDb(id);
    op.catch(e => console.error(isImport ? 'dismissTask sync failed:' : 'deleteTask sync failed:', e));
  };

  const addReviewTasks = () => {
    const existing = new Set(dayTasks.map(t => t.title.toLowerCase()));
    const add = todayReviews.filter(r => !existing.has(`revisar ${r.subjectName}`.toLowerCase()))
      .map(r => ({ id: Date.now().toString()+r.subjectId, title:`Revisar ${r.subjectName}`, category:'estudos', effort:'60', time:'', done:false, date:today }));
    if (add.length) updateState(p => ({ ...p, tasks: [...p.tasks, ...add] }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = dayTasks.findIndex(t => t.id === active.id);
    const newIdx = dayTasks.findIndex(t => t.id === over.id);
    const reordered = arrayMove(dayTasks, oldIdx, newIdx);
    const otherTasks = state.tasks.filter(t => t.date !== selectedDate);
    updateState(p => ({ ...p, tasks: [...otherTasks, ...reordered] }));
  };

  return (
    <div className="section-gap animate-in">
      {/* Gamification: streak, level, XP, daily rings */}
      <GameHeader stats={stats} onOpen={() => setShowProgress(true)} />

      {/* Today's classes → mark presente/faltei (only for today) */}
      {isToday && <AulasHoje state={state} updateState={updateState} userId={userId} />}

      {/* Day selector — pick a day to work (today or ahead) */}
      <div className="overflow-x-auto no-scrollbar py-1.5 -mx-1 px-1">
        <div className="flex gap-2">
          {dayStrip.map((d) => {
            const key = getDateKey(d);
            const sel = key === selectedDate;
            const isT = key === today;
            const count = taskCountByDate[key] || 0;
            return (
              <button key={key} onClick={() => setSelectedDate(key)} aria-pressed={sel}
                aria-label={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                className={`shrink-0 w-[50px] py-2 rounded-xl flex flex-col items-center gap-1 transition-colors ${
                  sel ? 'bg-indigo-500/20 ring-1 ring-indigo-500' : isT ? 'bg-[#27272a]' : 'bg-[#1c1c22] hover:bg-[#27272a]'
                }`}>
                <span className="text-[10px] text-zinc-500 capitalize">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                <span className={`text-sm font-semibold ${isT ? 'text-indigo-400' : 'text-white'}`}>{d.getDate()}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${count ? (sel ? 'bg-indigo-400' : 'bg-zinc-600') : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary with aria-live */}
      <div className="card flex items-center justify-between" aria-live="polite">
        <div>
          <p className="text-zinc-500 text-xs mb-1">{isToday ? 'Pendente hoje' : 'Pendente'}</p>
          <p className="text-white font-bold text-2xl tracking-tight">
            {hours > 0 ? `${hours}h` : ''}{mins > 0 ? `${mins}m` : hours === 0 ? '0m' : ''}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-zinc-500 text-xs mb-1">Feitas</p>
            <p className="text-white font-semibold text-lg">{doneCount}/{dayTasks.length}</p>
          </div>
          {dayTasks.length > 0 && (
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500/60 flex items-center justify-center"
              role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% das tarefas concluidas`}>
              <span className="text-xs font-bold text-indigo-400">{pct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Reviews (today only) */}
      {isToday && todayReviews.length > 0 && (
        <button onClick={addReviewTasks}
          className="w-full card-sm !bg-violet-500/5 !border-violet-500/15 flex items-center gap-4 hover:!bg-violet-500/10 transition-colors">
          <BookOpen size={18} className="text-violet-400 shrink-0" aria-hidden="true" />
          <div className="flex-1 text-left">
            <p className="text-[13px] font-medium text-violet-300">{todayReviews.length} revisao(es) agendada(s)</p>
            <p className="text-[11px] text-violet-400/60 mt-0.5">{todayReviews.map(r => r.subjectName).join(', ')}</p>
          </div>
          <span className="text-[11px] text-violet-400 font-medium shrink-0">Adicionar</span>
        </button>
      )}

      {/* Task list */}
      {dayTasks.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[#18181b] border border-zinc-800 flex items-center justify-center mb-4">
            <ClipboardList size={24} className="text-zinc-700" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-zinc-500">{isToday ? 'Nenhuma tarefa para hoje' : 'Nenhuma tarefa nesse dia'}</p>
          <p className="text-xs mt-1.5 text-zinc-700">Toque no + no topo pra adicionar</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={dayTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2.5 list-none" aria-label="Lista de tarefas do dia">
              {dayTasks.map(task => (
                <li key={task.id}>
                  <SortableTask task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={onEditTask} onFocus={onFocusTask} onGuide={setGuideId} />
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {guideId && <GuideViewer guideId={guideId} onClose={() => setGuideId(null)} />}
      {showProgress && <Progresso state={state} onClose={() => setShowProgress(false)} />}
    </div>
  );
}
