import { useMemo, useState } from 'react';
import { Plus, X, ArrowRight, ArrowLeft, FolderOpen } from 'lucide-react';
import {
  createKanbanCard as createKanbanCardDb,
  moveKanbanCard as moveKanbanCardDb,
  deleteKanbanCard as deleteKanbanCardDb,
} from '../store';

const columns = [
  { id: 'todo', title: 'A Fazer', accent: 'text-blue-400', border: 'border-t-blue-500' },
  { id: 'doing', title: 'Fazendo', accent: 'text-amber-400', border: 'border-t-amber-500' },
  { id: 'done', title: 'Feito', accent: 'text-green-400', border: 'border-t-green-500' },
];

const effortLabel = { '5': '5m', '10': '10m', '30': '30m', '60': '1h', '120': '2h+' };

export default function Trabalho({ state, updateState, userId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [nt, setNt] = useState({ title: '', project: '', priority: 'media', effort: '60' });
  const [projectFilter, setProjectFilter] = useState(null); // null = todas

  // Build the list of existing projects across all columns so the user can
  // pick one instead of re-typing (and filter the board by project).
  const projects = useMemo(() => {
    const set = new Set();
    for (const col of ['todo', 'doing', 'done']) {
      for (const task of state.kanban[col] || []) {
        if (task.project?.trim()) set.add(task.project.trim());
      }
    }
    return Array.from(set).sort();
  }, [state.kanban]);

  const isTmp = (id) => typeof id === 'string' && id.startsWith('tmp-');

  const addTask = async () => {
    if (!nt.title.trim()) return;
    const tmpId = 'tmp-' + Date.now();
    const draft = {
      id: tmpId, title: nt.title.trim(), project: nt.project.trim(),
      priority: nt.priority, effort: nt.effort, createdAt: new Date().toISOString(),
    };
    updateState(p => ({ ...p, kanban: { ...p.kanban, todo: [...p.kanban.todo, draft] } }));
    setNt({ title: '', project: '', priority: 'media', effort: '60' });
    setShowAdd(false);
    if (userId) {
      try {
        const saved = await createKanbanCardDb(userId, draft);
        updateState(p => ({
          ...p,
          kanban: { ...p.kanban, todo: p.kanban.todo.map(t => t.id === tmpId ? { ...t, id: saved.id } : t) },
        }));
      } catch (e) { console.error('kanban create failed:', e); }
    }
  };

  const move = (id, from, to) => {
    updateState(p => {
      const task = p.kanban[from].find(t => t.id === id);
      if (!task) return p;
      return { ...p, kanban: { ...p.kanban, [from]: p.kanban[from].filter(t => t.id !== id), [to]: [...p.kanban[to], task] } };
    });
    if (userId && !isTmp(id)) {
      moveKanbanCardDb(id, to).catch(e => console.error('kanban move failed:', e));
    }
  };

  const del = (id, col) => {
    updateState(p => ({ ...p, kanban: { ...p.kanban, [col]: p.kanban[col].filter(t => t.id !== id) } }));
    if (userId && !isTmp(id)) {
      deleteKanbanCardDb(id).catch(e => console.error('kanban delete failed:', e));
    }
  };

  return (
    <div className="section-gap animate-in">
      <button onClick={() => setShowAdd(true)}
        className="w-full card flex items-center justify-center gap-2 min-h-[52px] text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
        <Plus size={16} aria-hidden="true" /> Nova Task
      </button>

      {showAdd && (
        <div className="card space-y-4 animate-in">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-white">Nova Task</h3>
            <button onClick={() => setShowAdd(false)} aria-label="Fechar"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-white rounded-xl transition-colors"><X size={16} aria-hidden="true" /></button>
          </div>
          <label htmlFor="kanban-title" className="sr-only">Titulo da task</label>
          <input id="kanban-title" autoComplete="off" placeholder="Titulo da task" value={nt.title} onChange={e => setNt(p => ({ ...p, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTask()} autoFocus className="input-base" />
          {/* Project: pick existing (chips) or type a new name */}
          <div>
            <p className="text-xs text-zinc-500 mb-2">Projeto</p>
            {projects.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {projects.map(p => {
                  const active = nt.project.trim() === p;
                  return (
                    <button key={p} type="button" onClick={() => setNt(prev => ({ ...prev, project: active ? '' : p }))}
                      aria-pressed={active}
                      className={`px-3 min-h-[32px] rounded-full text-[11px] font-medium transition-colors ${
                        active ? 'bg-blue-500/25 text-blue-300' : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800'
                      }`}>
                      {p}
                    </button>
                  );
                })}
              </div>
            )}
            <label htmlFor="kanban-project" className="sr-only">Nome do projeto</label>
            <input id="kanban-project" autoComplete="off"
              placeholder={projects.length > 0 ? 'Ou digite um projeto novo' : 'Projeto (opcional)'}
              value={nt.project} onChange={e => setNt(p => ({ ...p, project: e.target.value }))} className="input-base" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-2">Prioridade</p>
            <div className="flex gap-2">
              {['baixa','media','alta'].map(p => (
                <button key={p} onClick={() => setNt(prev => ({ ...prev, priority: p }))}
                  aria-pressed={nt.priority === p}
                  className={`pill pill-${p} ${nt.priority === p ? 'active' : ''} capitalize`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-2">Esforco</p>
            <div className="flex gap-2">
              {[{v:'5',l:'5m'},{v:'10',l:'10m'},{v:'30',l:'30m'},{v:'60',l:'1h'},{v:'120',l:'2h+'}].map(e => (
                <button key={e.v} onClick={() => setNt(p => ({ ...p, effort: e.v }))}
                  aria-pressed={nt.effort === e.v}
                  className={`pill pill-${e.v} ${nt.effort === e.v ? 'active' : ''}`}>{e.l}</button>
              ))}
            </div>
          </div>
          <button onClick={addTask} className="w-full bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl text-sm font-medium transition-colors">Adicionar</button>
        </div>
      )}

      {/* Project filter chips — only shown when there's more than one project */}
      {projects.length > 1 && (
        <div className="card !py-3 flex items-center gap-2 flex-wrap">
          <FolderOpen size={12} className="text-zinc-500 shrink-0" aria-hidden="true" />
          <button onClick={() => setProjectFilter(null)}
            aria-pressed={projectFilter === null}
            className={`px-3 min-h-[32px] rounded-full text-[11px] font-medium transition-colors ${
              projectFilter === null ? 'bg-blue-500/25 text-blue-300' : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800'
            }`}>
            Todas
          </button>
          {projects.map(p => (
            <button key={p} onClick={() => setProjectFilter(projectFilter === p ? null : p)}
              aria-pressed={projectFilter === p}
              className={`px-3 min-h-[32px] rounded-full text-[11px] font-medium transition-colors ${
                projectFilter === p ? 'bg-blue-500/25 text-blue-300' : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800'
              }`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {columns.map(col => {
        const allTasks = state.kanban[col.id] || [];
        const tasks = projectFilter ? allTasks.filter(t => t.project === projectFilter) : allTasks;
        const next = col.id === 'todo' ? 'doing' : col.id === 'doing' ? 'done' : null;
        const prev = col.id === 'doing' ? 'todo' : col.id === 'done' ? 'doing' : null;
        return (
          <section key={col.id} className={`card border-t-2 ${col.border}`} aria-labelledby={`col-${col.id}`}>
            <div className="flex items-center justify-between mb-5">
              <h3 id={`col-${col.id}`} className={`text-sm font-semibold ${col.accent}`}>{col.title}</h3>
              <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-2.5 py-1 rounded-full" aria-label={`${tasks.length} tasks`}>{tasks.length}</span>
            </div>
            {tasks.length === 0 && <p className="text-xs text-zinc-600 py-6 text-center">Vazio</p>}
            <div className="flex flex-col gap-3">
              {tasks.map(task => (
                <div key={task.id} className="card-inner flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] text-zinc-200 flex-1 leading-relaxed">{task.title}</p>
                    <button onClick={() => del(task.id, col.id)} aria-label={`Deletar ${task.title}`}
                      className="text-zinc-700 hover:text-red-400 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0 -mt-1 -mr-1"><X size={14} aria-hidden="true" /></button>
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.project && <span className="tag tag-trabalho">{task.project}</span>}
                      <span className={`tag tag-prio-${task.priority}`}>{task.priority}</span>
                      <span className={`effort effort-${task.effort}`}>{effortLabel[task.effort]}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {prev && (
                        <button onClick={() => move(task.id, col.id, prev)}
                          aria-label={`Mover ${task.title} para ${prev === 'todo' ? 'A Fazer' : 'Fazendo'}`}
                          className="text-zinc-600 hover:text-indigo-400 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg">
                          <ArrowLeft size={14} aria-hidden="true" />
                        </button>
                      )}
                      {next && (
                        <button onClick={() => move(task.id, col.id, next)}
                          aria-label={`Mover ${task.title} para ${next === 'doing' ? 'Fazendo' : 'Feito'}`}
                          className="text-zinc-600 hover:text-indigo-400 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg">
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
