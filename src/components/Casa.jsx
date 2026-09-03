import { useState } from 'react';
import { Check, Cat, Trash2, Shirt, Bath, Sofa, Monitor, BedDouble, Plus, X, Dumbbell, Activity, Sprout, Sparkles, ShoppingCart, Scissors, Wallet, Wind, Refrigerator, Droplets } from 'lucide-react';
import {
  getDateKey,
  updateHomeRoutine as updateHomeRoutineDb,
  deleteHomeRoutine as deleteHomeRoutineDb,
  createCustomRoom as createCustomRoomDb,
  deleteCustomRoom as deleteCustomRoomDb,
  createTask as createTaskDb,
  updateTask as updateTaskDb,
} from '../store';
import { caiHoje } from '../lib/rotina';

const defaultRooms = [
  { key: 'areia_gato', label: 'Limpar areia do gato', icon: 'Cat', color: 'text-amber-400' },
  { key: 'comida_gato', label: 'Dar comida pro gato', icon: 'Cat', color: 'text-amber-400' },
  { key: 'sala', label: 'Limpar sala', icon: 'Sofa', color: 'text-blue-400' },
  { key: 'quarto', label: 'Arrumar quarto', icon: 'BedDouble', color: 'text-purple-400' },
  { key: 'escritorio', label: 'Organizar escritorio', icon: 'Monitor', color: 'text-cyan-400' },
  { key: 'banheiro', label: 'Limpar banheiro', icon: 'Bath', color: 'text-pink-400' },
  { key: 'lavanderia', label: 'Lavar roupas', icon: 'Shirt', color: 'text-indigo-400' },
  { key: 'lixo_organico', label: 'Descer lixo organico', icon: 'Trash2', color: 'text-green-400' },
  { key: 'lixo_reciclavel', label: 'Descer lixo reciclavel', icon: 'Trash2', color: 'text-emerald-400' },
];

const iconMap = { Cat, Trash2, Shirt, Bath, Sofa, Monitor, BedDouble, Dumbbell, Activity, Sprout,
  Sparkles, ShoppingCart, Scissors, Wallet, Wind, Refrigerator, Droplets };
const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const iconColorOptions = [
  { icon: 'Sofa', color: 'text-blue-400' },
  { icon: 'BedDouble', color: 'text-purple-400' },
  { icon: 'Monitor', color: 'text-cyan-400' },
  { icon: 'Bath', color: 'text-pink-400' },
  { icon: 'Shirt', color: 'text-indigo-400' },
  { icon: 'Trash2', color: 'text-green-400' },
  { icon: 'Cat', color: 'text-amber-400' },
];

function freqLabel(days) {
  if (days.length === 7) return 'Diario';
  if (days.length === 0) return 'Pausado';
  if (days.length === 1) return `Semanal (${dayLabels[days[0]]})`;
  return `${days.length}x/semana`;
}

export default function Casa({ state, updateState, userId }) {
  const today = getDateKey();
  const dayOfWeek = new Date().getDay();
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ label: '', icon: 'Sofa', color: 'text-blue-400', days: [], categoria: 'casa', intervalo: 1 });

  // Get all rooms (defaults + custom from state)
  const customRooms = state.customRooms || [];
  // Ensure all default rooms still show even if removed from homeRoutine (for visibility)
  const rooms = [...defaultRooms, ...customRooms];

  // A categoria da LINHA manda, nao 'casa' cravado. Com 'casa' fixo, rotina de
  // outra categoria (pilates, escala do terreiro, cuidado com os guias) nunca
  // casava com a tarefa do dia: aparecia sempre como nao feita e o clique criava
  // uma tarefa 'casa' duplicada.
  const catDe = (room) => state.homeRoutine[room.key]?.category || 'casa';

  // A tela nasceu "Casa" e o motor por baixo (home_routine + rotina.js) virou
  // generico: treino, escala de midia do terreiro, ritual de projeto e cuidado
  // com os guias entram por ele. Sem agrupar, 22 linhas viram uma lista sem
  // hierarquia e a rotina de casa se afoga no resto.
  const GRUPOS = [
    { cat: 'casa', label: 'Casa', cor: 'text-pink-400' },
    { cat: 'espiritual', label: 'Guias', cor: 'text-fuchsia-400' },
    { cat: 'terreiro', label: 'Terreiro', cor: 'text-green-400' },
    { cat: 'trabalho', label: 'Trabalho', cor: 'text-blue-400' },
    { cat: 'pessoal', label: 'Pessoal', cor: 'text-amber-400' },
  ];
  const gruposComItem = GRUPOS
    .map(g => ({ ...g, itens: rooms.filter(r => state.homeRoutine[r.key] && catDe(r) === g.cat) }))
    .filter(g => g.itens.length);

  // caiHoje, o mesmo do gerador de tarefa (store.js) e do push (edge function).
  // Antes era `days.includes(dayOfWeek)`, que ignora interval_weeks: item
  // quinzenal aparecia aqui toda semana, inclusive nas que nao geraram tarefa.
  // O cabecalho do rotina.js avisa disso: "se os dois discordarem, a tarefa
  // duplica ou some".
  const todayRoutine = rooms.filter(room => caiHoje(state.homeRoutine[room.key], today));

  const isTmp = (id) => typeof id === 'string' && id.startsWith('tmp-');

  const achaTask = (room) => state.tasks.find(t =>
    t.date === today && t.category === catDe(room) && t.title === room.label);

  const toggleDone = async (room) => {
    const existingTask = achaTask(room);
    if (existingTask) {
      const newDone = !existingTask.done;
      updateState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === existingTask.id ? { ...t, done: newDone } : t) }));
      if (userId && !isTmp(existingTask.id)) {
        updateTaskDb(existingTask.id, { done: newDone }).catch(e => console.error('casa toggle failed:', e));
      }
    } else {
      // New task created as already-done (user tapped the routine item).
      const tmpId = 'tmp-' + Date.now();
      const cfg = state.homeRoutine[room.key] || {};
      const draft = { id: tmpId, title: room.label, category: catDe(room),
        effort: cfg.effort || '30', time: cfg.time || '', done: true, date: today, recurring: true };
      updateState(prev => ({ ...prev, tasks: [...prev.tasks, draft] }));
      if (userId) {
        try {
          const saved = await createTaskDb(userId, draft);
          updateState(p => ({ ...p, tasks: p.tasks.map(t => t.id === tmpId ? { ...t, id: saved.id } : t) }));
        } catch (e) { console.error('casa task create failed:', e); }
      }
    }
  };

  const getTaskDone = (room) => achaTask(room)?.done || false;

  const toggleDay = (roomKey, dayIdx) => {
    // Compute next days synchronously, outside the setState updater. Capturing
    // via side-effect inside the updater is unreliable under StrictMode —
    // the outer variable can stay null when the Supabase upsert fires.
    const current = state.homeRoutine[roomKey]?.days || [];
    const nextDays = current.includes(dayIdx)
      ? current.filter(d => d !== dayIdx)
      : [...current, dayIdx].sort();
    updateState(prev => ({
      ...prev,
      homeRoutine: { ...prev.homeRoutine, [roomKey]: { ...prev.homeRoutine[roomKey], days: nextDays } },
    }));
    // Persist — upsert on (user_id, room_key)
    if (userId) {
      updateHomeRoutineDb(userId, roomKey, nextDays).catch(e => console.error('routine sync failed:', e));
    }
  };

  const addRoom = async () => {
    if (!newRoom.label.trim()) return;
    const key = 'custom_' + Date.now();
    const room = { key, label: newRoom.label.trim(), icon: newRoom.icon, color: newRoom.color };
    // categoria e intervalo entram no estado local tambem, senao o item nasce no
    // grupo errado e a checkbox procura tarefa da categoria errada ate o
    // proximo fetch.
    const cfg = { days: newRoom.days, category: newRoom.categoria, interval_weeks: newRoom.intervalo };
    updateState(prev => ({
      ...prev,
      customRooms: [...(prev.customRooms || []), room],
      homeRoutine: { ...prev.homeRoutine, [key]: cfg },
    }));
    const daysCopy = newRoom.days;
    const extraCopy = { category: newRoom.categoria, interval_weeks: newRoom.intervalo };
    setNewRoom({ label: '', icon: 'Sofa', color: 'text-blue-400', days: [], categoria: 'casa', intervalo: 1 });
    setShowAddRoom(false);
    if (userId) {
      try {
        await createCustomRoomDb(userId, room);
        await updateHomeRoutineDb(userId, key, daysCopy, extraCopy);
      } catch (e) { console.error('addRoom sync failed:', e); }
    }
  };

  const removeRoom = async (roomKey) => {
    updateState(prev => {
      const { [roomKey]: _, ...rest } = prev.homeRoutine;
      return {
        ...prev,
        homeRoutine: rest,
        customRooms: (prev.customRooms || []).filter(r => r.key !== roomKey),
      };
    });
    if (userId) {
      try {
        await deleteHomeRoutineDb(userId, roomKey);
        if (roomKey.startsWith('custom_')) await deleteCustomRoomDb(userId, roomKey);
      } catch (e) { console.error('removeRoom sync failed:', e); }
    }
  };

  const doneCount = todayRoutine.filter(r => getTaskDone(r)).length;

  return (
    <div className="section-gap animate-in">
      {/* Today's routine */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-white">Rotina de hoje</p>
            <p className="text-xs text-zinc-500 mt-1">{dayLabels[dayOfWeek]} - {todayRoutine.length} tarefas</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 tabular-nums">{doneCount}/{todayRoutine.length}</span>
            <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={todayRoutine.length > 0 ? Math.round((doneCount / todayRoutine.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${doneCount} de ${todayRoutine.length} tarefas feitas`}>
              <div className="h-full bg-pink-500 rounded-full transition-[width] duration-500 ease-out" style={{ width: `${todayRoutine.length > 0 ? (doneCount / todayRoutine.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {todayRoutine.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">Nada programado pra hoje!</p>
          ) : (
            todayRoutine.map(room => {
              const Icon = iconMap[room.icon] || Sofa;
              const done = getTaskDone(room);
              return (
                <button key={room.key} onClick={() => toggleDone(room)}
                  aria-label={`${room.label} — ${freqLabel(state.homeRoutine[room.key]?.days || [])}. ${done ? 'Feita' : 'Nao feita'}. Clique para ${done ? 'desmarcar' : 'marcar feita'}.`}
                  aria-pressed={done}
                  style={{ paddingLeft: '28px', paddingRight: '28px' }}
                  className={`w-full flex items-center gap-5 py-5 rounded-xl transition-colors min-h-[68px] ${done ? 'bg-[#27272a]/50 opacity-40' : 'bg-[#27272a] hover:bg-[#2f2f35]'}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${done ? 'bg-pink-500 border-pink-500' : 'border-zinc-600'}`}>
                    {done && <Check size={12} className="text-white" aria-hidden="true" />}
                  </div>
                  <Icon size={16} className={`${room.color} shrink-0`} aria-hidden="true" />
                  <span className={`text-sm flex-1 text-left ${done ? 'line-through text-zinc-500' : 'text-white'}`}>{room.label}</span>
                  <span className="text-[10px] text-zinc-600 pl-4 shrink-0">{freqLabel(state.homeRoutine[room.key]?.days || [])}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Full Routine Schedule - editable */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-medium text-white">Rotina semanal completa</h3>
          <button onClick={() => setShowAddRoom(true)} aria-label="Adicionar tarefa de casa"
            className="text-[11px] text-pink-400 hover:text-pink-300 transition-colors min-h-[36px] px-2 flex items-center gap-1">
            <Plus size={12} aria-hidden="true" /> Adicionar
          </button>
        </div>

        {showAddRoom && (
          <div className="card-inner mb-5 space-y-4 animate-in">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-300">Nova tarefa</p>
              <button onClick={() => setShowAddRoom(false)} aria-label="Fechar" className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <input placeholder="Nome da tarefa" value={newRoom.label}
              onChange={e => setNewRoom(p => ({ ...p, label: e.target.value }))}
              autoComplete="off" className="input-base text-[13px]" />
            <div>
              <p className="text-[11px] text-zinc-500 mb-2">Icone</p>
              <div className="flex flex-wrap gap-2">
                {iconColorOptions.map(opt => {
                  const IconC = iconMap[opt.icon];
                  const selected = newRoom.icon === opt.icon;
                  return (
                    <button key={opt.icon} onClick={() => setNewRoom(p => ({ ...p, icon: opt.icon, color: opt.color }))}
                      aria-label={`Icone ${opt.icon}`} aria-pressed={selected}
                      className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${selected ? 'bg-pink-500/20 ring-1 ring-pink-500' : 'bg-zinc-800/50 hover:bg-zinc-800'}`}>
                      <IconC size={16} className={opt.color} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-2">Dias da semana</p>
              <div className="grid grid-cols-7 gap-1.5">
                {dayNames.map((d, i) => {
                  const active = newRoom.days.includes(i);
                  return (
                    <button key={i} onClick={() => setNewRoom(p => ({ ...p, days: active ? p.days.filter(x => x !== i) : [...p.days, i].sort() }))}
                      aria-label={`${dayLabels[i]} - ${active ? 'ativo' : 'inativo'}`} aria-pressed={active}
                      className={`h-10 rounded-lg text-[11px] font-medium transition-colors ${active ? 'bg-pink-500/25 text-pink-300' : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800'}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-2">Onde isso vive</p>
              <div className="grid grid-cols-3 gap-1.5">
                {GRUPOS.map(g => (
                  <button key={g.cat} onClick={() => setNewRoom(p => ({ ...p, categoria: g.cat }))}
                    aria-pressed={newRoom.categoria === g.cat}
                    className={`h-10 rounded-lg text-[11px] font-medium transition-colors ${
                      newRoom.categoria === g.cat ? `bg-zinc-700 ${g.cor}` : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800'}`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500 mb-2">Com que frequencia</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[[1, 'Toda semana'], [2, 'Quinzenal'], [4, 'Mensal']].map(([n, rotulo]) => (
                  <button key={n} onClick={() => setNewRoom(p => ({ ...p, intervalo: n }))}
                    aria-pressed={newRoom.intervalo === n}
                    className={`h-10 rounded-lg text-[11px] font-medium transition-colors ${
                      newRoom.intervalo === n ? 'bg-pink-500/25 text-pink-300' : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800'}`}>
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={addRoom} disabled={!newRoom.label.trim() || newRoom.days.length === 0}
              className="w-full bg-pink-500 hover:bg-pink-400 disabled:opacity-20 text-white py-2.5 rounded-xl text-xs font-medium transition-colors">
              Criar tarefa
            </button>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {gruposComItem.map(grupo => (
          <div key={grupo.cat} className="flex flex-col gap-5">
            {gruposComItem.length > 1 && (
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${grupo.cor}`}>
                {grupo.label} <span className="text-zinc-700 font-normal">· {grupo.itens.length}</span>
              </p>
            )}
          {grupo.itens.map(room => {
            const config = state.homeRoutine[room.key];
            if (!config) return null;
            const Icon = iconMap[room.icon] || Sofa;
            const isCustom = room.key.startsWith('custom_');
            return (
              <div key={room.key} className="flex flex-col gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={14} className={`${room.color} shrink-0`} aria-hidden="true" />
                  <span className="text-xs text-zinc-300 flex-1 truncate">{room.label}</span>
                  <span className="text-[10px] text-zinc-600 shrink-0">{freqLabel(config.days)}</span>
                  {isCustom && (
                    <button onClick={() => removeRoom(room.key)} aria-label={`Remover ${room.label}`}
                      className="text-zinc-700 hover:text-red-400 transition-colors w-7 h-7 flex items-center justify-center shrink-0">
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {dayNames.map((d, i) => {
                    const active = config.days.includes(i);
                    return (
                      <button key={i} onClick={() => toggleDay(room.key, i)}
                        aria-label={`${room.label} em ${dayLabels[i]}: ${active ? 'ativo' : 'inativo'}. Clique para alternar.`}
                        aria-pressed={active}
                        className={`h-8 rounded-lg text-[10px] flex items-center justify-center font-medium transition-colors ${
                          active ? 'bg-pink-500/25 text-pink-300 hover:bg-pink-500/35' : 'bg-zinc-800/50 text-zinc-600 hover:bg-zinc-800'
                        }`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-600 mt-6 pt-5 border-t border-zinc-800/60">* Cozinha e louca: seu namorado cuida</p>
      </div>
    </div>
  );
}
