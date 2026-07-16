import { useState, useEffect, useCallback } from 'react';
import { loadCache, saveCache, fetchAllData, createTask, updateTask as updateTaskDb, defaultState, getDateKey, ensureTodayRoutineTasks } from './store';
import { buildCircularTask } from './lib/circular';
import { useAuth } from './lib/auth';
import Login from './components/Login';
import Hoje from './components/Hoje';
import Semana from './components/Semana';
import Estudos from './components/Estudos';
import Trabalho from './components/Trabalho';
import Casa from './components/Casa';
import Agua from './components/Agua';
import Pomodoro from './components/Pomodoro';
import AIPanel from './components/AIPanel';
import {
  CalendarCheck, CalendarDays, GraduationCap, Briefcase,
  Home, Droplets, Brain, Timer, Plus, X, LogOut, Loader2,
  Bell, BellRing, Smartphone
} from 'lucide-react';
import { getPushState, enablePush, disablePush, isStandalone, pushSupported } from './lib/push';
import { supabase } from './lib/supabase';

const tabs = [
  { id: 'hoje', label: 'Hoje', icon: CalendarCheck },
  { id: 'semana', label: 'Semana', icon: CalendarDays },
  { id: 'estudos', label: 'Estudos', icon: GraduationCap },
  { id: 'pomodoro', label: 'Pomodoro', icon: Timer },
  { id: 'trabalho', label: 'Trabalho', icon: Briefcase },
  { id: 'casa', label: 'Casa', icon: Home },
  { id: 'agua', label: 'Agua', icon: Droplets },
  { id: 'ia', label: 'IA', icon: Brain },
];

const categories = ['aula', 'estudos', 'trabalho', 'terreiro', 'pessoal', 'casa'];
const efforts = [
  { v: '5', l: '5m' },
  { v: '10', l: '10m' },
  { v: '30', l: '30m' },
  { v: '60', l: '~1h' },
  { v: '120', l: '2h+' },
];

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 size={28} className="animate-spin text-indigo-400" aria-hidden="true" />
      <p className="text-sm text-zinc-500">Carregando...</p>
    </div>
  );
}

function OrganizadorApp() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('hoje');
  const [state, setState] = useState(() => loadCache());
  const [showAddTask, setShowAddTask] = useState(false);
  // editingId is null when adding a new task, or the existing task id when editing.
  // generateCircular is surfaced only when category === 'aula' && time is set.
  const [editingId, setEditingId] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '', category: 'pessoal', effort: '30', time: '',
    date: getDateKey(), generateCircular: true, requiredPomodoros: 0,
  });
  // When set, Pomodoro pre-selects this focus target (e.g. "task|<id>").
  const [focusPreselect, setFocusPreselect] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Fetch data from Supabase on mount
  useEffect(() => {
    if (!user) return;
    setSyncing(true);
    fetchAllData(user.id)
      .then(async data => {
        setState(data);
        saveCache(data);
        // Auto-drop today's home routine onto the day board, once per day.
        // Dedupes against existing casa tasks, so it can't double up; the
        // per-day flag stops it from re-adding items the user deleted today.
        const dayFlag = 'routine_gen_' + getDateKey();
        if (!localStorage.getItem(dayFlag)) {
          try {
            const created = await ensureTodayRoutineTasks(user.id, data);
            if (created.length) setState(prev => ({ ...prev, tasks: [...prev.tasks, ...created] }));
            localStorage.setItem(dayFlag, '1');
          } catch (e) { console.error('routine auto-gen failed:', e); }
        }
      })
      .catch(err => console.error('Fetch failed, using cache:', err))
      .finally(() => setSyncing(false));
  }, [user]);

  // Save cache on every state change (for offline/fast-reload)
  useEffect(() => { saveCache(state); }, [state]);

  const updateState = useCallback((updater) => {
    setState(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
  }, []);

  // Manual "Rotina casa" button in Hoje. Same materialization as the auto-run,
  // so custom rooms get real titles and everything persists + dedupes.
  const generateRoutine = useCallback(async () => {
    if (!user) return;
    try {
      const created = await ensureTodayRoutineTasks(user.id, state);
      if (created.length) setState(prev => ({ ...prev, tasks: [...prev.tasks, ...created] }));
    } catch (e) { console.error('generateRoutine failed:', e); }
  }, [user, state]);

  // ── Push notifications ───────────────────────────────────────────────
  const [push, setPush] = useState({ supported: pushSupported(), permission: 'default', subscribed: false });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState('');
  useEffect(() => { if (showMenu) getPushState().then(setPush).catch(() => {}); }, [showMenu]);

  const handleEnablePush = async () => {
    setPushBusy(true); setPushMsg('');
    const r = await enablePush(user.id);
    if (!r.ok) {
      const m = {
        'not-installed': 'Instale o app na tela de inicio primeiro: Compartilhar → Adicionar a Tela de Inicio. Depois abra pelo icone.',
        'denied': 'Permissao negada. Libere em Ajustes → Organizador → Notificacoes.',
        'unsupported': 'Esse navegador nao suporta push.',
        'no-vapid-key': 'Falta configurar a chave VAPID no deploy.',
        'save-failed': 'Nao consegui salvar a inscricao. Tenta de novo.',
      };
      setPushMsg(m[r.reason] || 'Nao rolou. Tenta de novo.');
    }
    setPush(await getPushState());
    setPushBusy(false);
  };
  const handleTestPush = async () => {
    setPushBusy(true); setPushMsg('');
    const { error } = await supabase.functions.invoke('send-push', { body: { test: true } });
    setPushMsg(error ? 'Falha ao enviar teste.' : 'Teste enviado. Deve chegar em segundos.');
    setPushBusy(false);
  };
  const handleDisablePush = async () => {
    setPushBusy(true); setPushMsg('');
    await disablePush(user.id);
    setPush(await getPushState()); setPushBusy(false);
  };

  const resetTaskForm = () => {
    setEditingId(null);
    setNewTask({ title: '', category: 'pessoal', effort: '30', time: '', date: getDateKey(), generateCircular: true, requiredPomodoros: 0 });
  };

  const openAddTask = () => {
    resetTaskForm();
    setShowAddTask(true);
  };

  // Called from Hoje when user taps the pencil. Prefill form with existing
  // task so they can fix category / time / date / effort / title without
  // deleting and re-adding. Imports (Classroom etc.) become editable too.
  const openEditTask = (task) => {
    setEditingId(task.id);
    setNewTask({
      title: task.title || '',
      category: task.category || 'pessoal',
      effort: task.effort || '30',
      time: task.time || '',
      date: task.date || getDateKey(),
      generateCircular: false, // explicit opt-in on edit to avoid surprises
      requiredPomodoros: task.required_pomodoros || 0,
    });
    setShowAddTask(true);
  };

  // From a pomodoro-gated task in Hoje: jump to Pomodoro focused on it.
  const focusTask = (task) => {
    setFocusPreselect(`task|${task.id}`);
    setActiveTab('pomodoro');
  };

  // If the task qualifies (category=aula + time set), compute the "pegar
  // circular" companion and insert it. Returns the saved companion id or null.
  const maybeCreateCircular = async (parentTask) => {
    if (parentTask.category !== 'aula' || !parentTask.time) return null;
    const circular = buildCircularTask(parentTask);
    if (!circular) return null;
    const tmpId = 'tmp-circ-' + Date.now();
    const companion = { ...circular, id: tmpId, companion_task_id: parentTask.id };
    updateState(prev => ({ ...prev, tasks: [...prev.tasks, companion] }));
    if (!user) return tmpId;
    try {
      const saved = await createTask(user.id, companion);
      updateState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === tmpId ? { ...t, id: saved.id } : t),
      }));
      return saved.id;
    } catch (e) {
      console.error('createCircular sync failed:', e);
      return tmpId;
    }
  };

  const saveTask = async () => {
    if (!newTask.title.trim()) return;
    const payload = {
      title: newTask.title.trim(),
      category: newTask.category,
      effort: newTask.effort,
      time: newTask.time,
      date: newTask.date || getDateKey(),
      required_pomodoros: newTask.requiredPomodoros || 0,
    };
    const shouldGenCircular = newTask.category === 'aula' && !!newTask.time && newTask.generateCircular;

    if (editingId) {
      // Edit existing task
      updateState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === editingId ? { ...t, ...payload } : t),
      }));
      if (typeof editingId === 'string' && !editingId.startsWith('tmp-')) {
        updateTaskDb(editingId, payload).catch(e => console.error('updateTask sync failed:', e));
      }
      if (shouldGenCircular) {
        await maybeCreateCircular({ id: editingId, ...payload });
      }
    } else {
      // Create new task
      const tmpId = 'tmp-' + Date.now();
      const task = { id: tmpId, ...payload, done: false, recurring: false };
      updateState(prev => ({ ...prev, tasks: [...prev.tasks, task] }));
      let realId = tmpId;
      if (user) {
        try {
          const saved = await createTask(user.id, task);
          realId = saved.id;
          updateState(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => t.id === tmpId ? { ...t, id: realId } : t),
          }));
        } catch (e) { console.error('createTask sync failed:', e); }
      }
      if (shouldGenCircular) {
        await maybeCreateCircular({ id: realId, ...payload });
      }
    }

    resetTaskForm();
    setShowAddTask(false);
  };

  const renderTab = () => {
    const p = { state, updateState, userId: user?.id };
    switch (activeTab) {
      case 'hoje': return <Hoje {...p} onAddTask={openAddTask} onEditTask={openEditTask} onGenerateRoutine={generateRoutine} onFocusTask={focusTask} />;
      case 'semana': return <Semana {...p} />;
      case 'estudos': return <Estudos {...p} />;
      case 'pomodoro': return <Pomodoro {...p} preselectKey={focusPreselect} onPreselectConsumed={() => setFocusPreselect(null)} />;
      case 'trabalho': return <Trabalho {...p} />;
      case 'casa': return <Casa {...p} />;
      case 'agua': return <Agua {...p} />;
      case 'ia': return <AIPanel {...p} />;
    }
  };

  return (
    <div className="app-container bg-[#09090b] relative">
      {/* Header */}
      <header className="page-x pt-6 pb-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Organizador</h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncing && <Loader2 size={14} className="animate-spin text-zinc-600" aria-label="Sincronizando" />}
          <button onClick={() => setShowMenu(true)} aria-label="Menu"
            className="w-11 h-11 rounded-full bg-zinc-800/50 hover:bg-zinc-800 flex items-center justify-center transition-colors shrink-0">
            <span className="text-xs text-zinc-400 font-medium uppercase">{user?.email?.[0] || 'U'}</span>
          </button>
          <button onClick={openAddTask} aria-label="Adicionar tarefa"
            className="w-11 h-11 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-colors shrink-0">
            <Plus size={18} className="text-white" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto page-x pb-safe">
        {renderTab()}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#09090b]/95 backdrop-blur-lg border-t border-zinc-800/50 z-40 flex justify-center"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="w-full max-w-[640px] overflow-x-auto no-scrollbar">
        <div className="flex justify-around gap-0.5 py-2 px-2 sm:px-6 w-max min-w-full mx-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-label={tab.label}
                className={`flex flex-col items-center gap-1 shrink-0 min-w-[44px] min-h-[48px] justify-center rounded-xl transition-colors text-[10px] ${
                  active ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
                }`}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
        </div>
      </nav>

      {/* User Menu Modal */}
      {showMenu && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={e => e.target === e.currentTarget && setShowMenu(false)}>
          <div className="w-full sm:max-w-sm bg-[#18181b] border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl animate-in flex flex-col"
            style={{ maxHeight: 'min(90vh, 900px)' }}>
            {/* Sticky header */}
            <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-zinc-800/50 shrink-0">
              <h3 className="text-base font-semibold text-white">Conta</h3>
              <button onClick={() => setShowMenu(false)} aria-label="Fechar"
                className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-white rounded-xl transition-colors -mr-2">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-7 pt-6 pb-8 flex-1">
            <p className="text-xs text-zinc-500 mb-1">Logado como</p>
            <p className="text-sm text-white font-medium mb-8 break-all">{user?.email}</p>

            {/* Push notifications */}
            <div className="card-inner mb-6">
              <p className="text-xs font-semibold text-zinc-300 flex items-center gap-2 mb-4">
                <Bell size={14} className="text-indigo-400" aria-hidden="true" /> Notificacoes
              </p>
              {!push.supported ? (
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Esse navegador nao suporta notificacoes push.
                </p>
              ) : !isStandalone() ? (
                <div className="flex items-start gap-2">
                  <Smartphone size={14} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Pra receber push no iPhone, instale o app: toque em <span className="text-zinc-200">Compartilhar</span> no
                    Safari → <span className="text-zinc-200">Adicionar a Tela de Inicio</span>. Depois abra pelo icone e volte aqui.
                  </p>
                </div>
              ) : push.subscribed ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <BellRing size={14} className="text-green-400 shrink-0" aria-hidden="true" />
                    <p className="text-xs text-zinc-300">Ativado neste aparelho</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleTestPush} disabled={pushBusy}
                      className="flex-1 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 rounded-xl min-h-[44px] text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                      {pushBusy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : 'Enviar teste'}
                    </button>
                    <button onClick={handleDisablePush} disabled={pushBusy}
                      className="flex-1 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 rounded-xl min-h-[44px] text-xs font-medium transition-colors disabled:opacity-50">
                      Desativar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">
                    Lembretes de rotina, tarefas com horario e provas direto no aparelho.
                  </p>
                  <button onClick={handleEnablePush} disabled={pushBusy}
                    className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors text-xs flex items-center justify-center gap-2">
                    {pushBusy ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Ativando</> : <><Bell size={13} aria-hidden="true" /> Ativar notificacoes</>}
                  </button>
                </>
              )}
              {pushMsg && (
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-3 bg-zinc-800/50 rounded-lg p-2.5">{pushMsg}</p>
              )}
            </div>

            <button onClick={async () => { await signOut(); setShowMenu(false); }}
              className="w-full bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 font-medium py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
              <LogOut size={14} aria-hidden="true" /> Sair
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal — also used for editing existing tasks */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={e => e.target === e.currentTarget && setShowAddTask(false)}>
          <div className="w-full sm:max-w-md bg-[#18181b] border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl px-7 pt-8 pb-10 animate-in overflow-y-auto"
            style={{ maxHeight: 'min(92vh, 820px)' }}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-base font-semibold text-white">{editingId ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
              <button onClick={() => setShowAddTask(false)} aria-label="Fechar"
                className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-white rounded-xl transition-colors -mr-2">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-7">
              <div>
                <label htmlFor="task-title" className="text-xs text-zinc-500 mb-2 block">O que precisa fazer?</label>
                <input id="task-title" type="text" placeholder="Titulo da tarefa" value={newTask.title}
                  autoComplete="off" autoCorrect="off" spellCheck="false"
                  onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveTask()} autoFocus className="input-base" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="task-date" className="text-xs text-zinc-500 mb-2 block">Data</label>
                  <input id="task-date" type="date" value={newTask.date}
                    onChange={e => setNewTask(p => ({ ...p, date: e.target.value }))} className="input-base" />
                </div>
                <div>
                  <label htmlFor="task-time" className="text-xs text-zinc-500 mb-2 block">Horario (opcional)</label>
                  <input id="task-time" type="time" value={newTask.time}
                    onChange={e => setNewTask(p => ({ ...p, time: e.target.value }))} className="input-base" />
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-3">Categoria</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <button key={c} onClick={() => setNewTask(p => ({ ...p, category: c }))}
                      className={`pill pill-${c} ${newTask.category === c ? 'active' : ''} capitalize`}>{c}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-3">Esforco estimado</p>
                <div className="flex gap-2 flex-wrap">
                  {efforts.map(e => (
                    <button key={e.v} onClick={() => setNewTask(p => ({ ...p, effort: e.v }))}
                      className={`pill pill-${e.v} ${newTask.effort === e.v ? 'active' : ''}`}>{e.l}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1">Pomodoros pra concluir</p>
                <p className="text-[11px] text-zinc-600 mb-3">So conta como feita depois desses focos. Bom pra tarefa de estudo.</p>
                <div className="flex gap-2 flex-wrap">
                  {[0, 1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => setNewTask(p => ({ ...p, requiredPomodoros: n }))}
                      aria-pressed={newTask.requiredPomodoros === n}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-medium transition-colors ${
                        newTask.requiredPomodoros === n ? 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-500/50' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                      }`}>{n === 0 ? 'Nenhum' : `${n} 🍅`}</button>
                  ))}
                </div>
              </div>

              {/* Circular companion toggle — only shown for "aula" with a time */}
              {newTask.category === 'aula' && newTask.time && (
                <label className="flex items-start gap-3 bg-cyan-500/10 border border-cyan-500/25 rounded-xl p-3 cursor-pointer">
                  <input type="checkbox" checked={newTask.generateCircular}
                    onChange={e => setNewTask(p => ({ ...p, generateCircular: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 accent-cyan-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-cyan-200">Gerar tarefa "Pegar circular"</p>
                    <p className="text-[11px] text-cyan-400/70 leading-relaxed mt-0.5">
                      Calcula a hora de sair de casa pra pegar o 110 e chegar na aula a tempo (10min caminhada + 5min bus + 7min ate a sala + 5min buffer).
                    </p>
                  </div>
                </label>
              )}

              <button onClick={saveTask} disabled={!newTask.title.trim()}
                className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-20 text-white font-medium py-4 rounded-xl transition-colors text-sm mt-2">
                {editingId ? 'Salvar alteracoes' : 'Adicionar tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <Login />;
  return <OrganizadorApp />;
}
