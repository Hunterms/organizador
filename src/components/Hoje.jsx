import { useMemo } from 'react';
import {
  getDateKey, getTodayReviews,
  updateTask as updateTaskDb, deleteTask as deleteTaskDb, dismissTask as dismissTaskDb,
} from '../store';
import { Check, Clock, Sparkles, Trash2, ClipboardList, BookOpen, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const catBorder = { estudos: 'border-l-violet-500', trabalho: 'border-l-blue-500', terreiro: 'border-l-green-500', pessoal: 'border-l-amber-500', casa: 'border-l-pink-500' };
const effortLabel = { '5': '5m', '10': '10m', '30': '30m', '60': '1h', '120': '2h+' };

function SortableTask({ task, onToggle, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : undefined };

  return (
    <div ref={setNodeRef} style={style}
      className={`card-sm border-l-[3px] ${catBorder[task.category] || 'border-l-zinc-700'} flex items-center gap-2 transition-colors ${task.done ? 'opacity-40' : ''}`}>
      <button {...attributes} {...listeners}
        aria-label={`Arrastar tarefa ${task.title}`}
        className="drag-handle text-zinc-700 hover:text-zinc-500 shrink-0 -ml-2 min-w-[36px] min-h-[36px] flex items-center justify-center">
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <button onClick={() => onToggle(task.id)}
        aria-label={task.done ? `Desmarcar ${task.title}` : `Marcar ${task.title} como feita`}
        aria-pressed={task.done}
        className={`min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0 transition-colors`}>
        <span className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${task.done ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-700 hover:border-indigo-400'}`}>
          {task.done && <Check size={11} className="text-white" aria-hidden="true" />}
        </span>
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug ${task.done ? 'line-through text-zinc-600' : 'text-zinc-200'}`}>{task.title}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {task.time && <span className="text-[10px] text-zinc-600 flex items-center gap-0.5"><Clock size={9} aria-hidden="true" /> {task.time}</span>}
          <span className={`tag tag-${task.category} capitalize`}>{task.category}</span>
          <span className={`effort effort-${task.effort}`}>{effortLabel[task.effort] || '30m'}</span>
        </div>
      </div>
      <button onClick={() => onDelete(task.id)} aria-label={`Deletar ${task.title}`}
        className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center">
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function Hoje({ state, updateState, onAddTask }) {
  const today = getDateKey();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const todayTasks = useMemo(() => {
    return state.tasks
      .filter(t => t.date === today)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return 0;
      });
  }, [state.tasks, today]);

  const totalMinutes = todayTasks.filter(t => !t.done).reduce((sum, t) => sum + parseInt(t.effort || '30'), 0);
  const doneCount = todayTasks.filter(t => t.done).length;
  const todayReviews = useMemo(() => getTodayReviews(state.subjects), [state.subjects]);
  const pct = todayTasks.length > 0 ? Math.round((doneCount / todayTasks.length) * 100) : 0;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  // Optimistic update in local state, then sync to Supabase. If the sync fails
  // we log to console but keep the optimistic state — simpler UX than rolling
  // back. Skipping 'tmp-' ids (tasks still in-flight from add).
  const toggleTask = (id) => {
    let nextDone = null;
    updateState(p => ({ ...p, tasks: p.tasks.map(t => {
      if (t.id !== id) return t;
      nextDone = !t.done;
      return { ...t, done: nextDone };
    }) }));
    if (typeof id === 'string' && id.startsWith('tmp-')) return;
    updateTaskDb(id, { done: nextDone }).catch(e => console.error('toggleTask sync failed:', e));
  };
  const deleteTask = (id) => {
    // Decide dismiss vs hard-delete BEFORE we drop the task from state.
    // Imports (classroom / work_calendar / moodle / class) get dismissed so the
    // next sync doesn't re-create them. Manual tasks get hard-deleted.
    const task = state.tasks.find(t => t.id === id);
    const isImport = task?.source && task.source !== 'manual';
    updateState(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id) }));
    if (typeof id === 'string' && id.startsWith('tmp-')) return;
    const op = isImport ? dismissTaskDb(id) : deleteTaskDb(id);
    op.catch(e => console.error(isImport ? 'dismissTask sync failed:' : 'deleteTask sync failed:', e));
  };

  const generateHomeTasks = () => {
    const dow = new Date().getDay();
    const existing = new Set(todayTasks.map(t => t.title.toLowerCase()));
    const labels = { areia_gato:'Limpar areia do gato', comida_gato:'Dar comida pro gato', sala:'Limpar sala', quarto:'Arrumar quarto', escritorio:'Organizar escritorio', banheiro:'Limpar banheiro', lavanderia:'Lavar roupas', lixo_organico:'Descer lixo organico', lixo_reciclavel:'Descer lixo reciclavel' };
    const add = [];
    Object.entries(state.homeRoutine).forEach(([k, c]) => {
      if (c.days.includes(dow) && !existing.has(labels[k]?.toLowerCase()))
        add.push({ id: Date.now().toString()+k, title: labels[k], category:'casa', effort:'30', time:'', done:false, date:today, recurring:true });
    });
    if (add.length) updateState(p => ({ ...p, tasks: [...p.tasks, ...add] }));
  };

  const addReviewTasks = () => {
    const existing = new Set(todayTasks.map(t => t.title.toLowerCase()));
    const add = todayReviews.filter(r => !existing.has(`revisar ${r.subjectName}`.toLowerCase()))
      .map(r => ({ id: Date.now().toString()+r.subjectId, title:`Revisar ${r.subjectName}`, category:'estudos', effort:'60', time:'', done:false, date:today }));
    if (add.length) updateState(p => ({ ...p, tasks: [...p.tasks, ...add] }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = todayTasks.findIndex(t => t.id === active.id);
    const newIdx = todayTasks.findIndex(t => t.id === over.id);
    const reordered = arrayMove(todayTasks, oldIdx, newIdx);
    const otherTasks = state.tasks.filter(t => t.date !== today);
    updateState(p => ({ ...p, tasks: [...otherTasks, ...reordered] }));
  };

  return (
    <div className="section-gap animate-in">
      {/* Summary with aria-live */}
      <div className="card flex items-center justify-between" aria-live="polite">
        <div>
          <p className="text-zinc-500 text-xs mb-1">Pendente hoje</p>
          <p className="text-white font-bold text-2xl tracking-tight">
            {hours > 0 ? `${hours}h` : ''}{mins > 0 ? `${mins}m` : hours === 0 ? '0m' : ''}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-zinc-500 text-xs mb-1">Feitas</p>
            <p className="text-white font-semibold text-lg">{doneCount}/{todayTasks.length}</p>
          </div>
          {todayTasks.length > 0 && (
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500/60 flex items-center justify-center"
              role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% das tarefas concluidas`}>
              <span className="text-xs font-bold text-indigo-400">{pct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      {todayReviews.length > 0 && (
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

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={generateHomeTasks}
          className="flex-1 card-sm !py-3 flex items-center justify-center gap-2 text-[13px] text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f23] transition-colors">
          <Sparkles size={14} className="text-pink-400" aria-hidden="true" /> Rotina casa
        </button>
        <button onClick={onAddTask}
          className="flex-1 bg-indigo-500/10 border border-indigo-500/20 rounded-[14px] py-3 flex items-center justify-center gap-2 text-[13px] text-indigo-400 hover:bg-indigo-500/15 transition-colors">
          + Tarefa
        </button>
      </div>

      {/* Task list */}
      {todayTasks.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[#18181b] border border-zinc-800 flex items-center justify-center mb-4">
            <ClipboardList size={24} className="text-zinc-700" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-zinc-500">Nenhuma tarefa para hoje</p>
          <p className="text-xs mt-1.5 text-zinc-700">Adicione tarefas ou gere a rotina da casa</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={todayTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2.5 list-none" aria-label="Lista de tarefas de hoje">
              {todayTasks.map(task => (
                <li key={task.id}>
                  <SortableTask task={task} onToggle={toggleTask} onDelete={deleteTask} />
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
