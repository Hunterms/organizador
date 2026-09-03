import { useState } from 'react';
import { CalendarClock, Plus, X, Trash2, ListChecks } from 'lucide-react';
import {
  getDateKey,
  createEvento as createEventoDb,
  updateEvento as updateEventoDb,
  deleteEvento as deleteEventoDb,
} from '../store';
import { proximaOcorrencia, preparoDeHoje } from '../lib/eventos';

// ==========================================================================
// Eventos com preparo. A gira e o caso que motivou: recorrencia responde "cai
// hoje?", evento responde "o que a data de sabado exige de mim HOJE?".
//
// ESCOPO DESTA TELA, de proposito estreito: ela edita DATA, que e o que muda
// (a gira do mes que vem). O checklist e template — assenta uma vez e fica —
// e mora no seed-coordenacao.sql. Construir CRUD de array aninhado pra um dado
// que muda de semestre em semestre seria tela caindo em desuso.
// ==========================================================================
const rotuloData = (d) => {
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}${a !== String(new Date().getFullYear()) ? '/' + a.slice(2) : ''}`;
};

const diasAte = (d, hoje) =>
  Math.round((new Date(d + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);

export default function Eventos({ state, updateState, userId }) {
  const hoje = getDateKey();
  const eventos = state.eventos || [];
  const [novo, setNovo] = useState(null);       // { nome } quando o form esta aberto
  const [addData, setAddData] = useState({});   // { [eventoId]: 'YYYY-MM-DD' }

  const patch = (id, updates) => {
    updateState(prev => ({
      ...prev,
      eventos: (prev.eventos || []).map(e => e.id === id ? { ...e, ...updates } : e),
    }));
    if (userId && !String(id).startsWith('tmp-')) {
      updateEventoDb(id, updates).catch(e => console.error('evento sync failed:', e));
    }
  };

  const addData_ = (ev) => {
    const d = addData[ev.id];
    if (!d || (ev.datas || []).includes(d)) return;
    patch(ev.id, { datas: [...(ev.datas || []), d].sort() });
    setAddData(p => ({ ...p, [ev.id]: '' }));
  };

  const removeData = (ev, d) =>
    patch(ev.id, { datas: (ev.datas || []).filter(x => x !== d) });

  const criar = async () => {
    const nome = (novo?.nome || '').trim();
    if (!nome) return;
    const tmpId = 'tmp-' + Date.now();
    // Checklist do novo evento nasce vazio: sem item ele nao gera tarefa
    // nenhuma (preparoDeHoje ignora evento sem checklist), o que e o correto
    // ate ele decidir o preparo.
    const draft = { id: tmpId, nome, categoria: 'terreiro', place: '', datas: [], recorrencia: null, checklist: [] };
    updateState(prev => ({ ...prev, eventos: [...(prev.eventos || []), draft] }));
    setNovo(null);
    if (userId) {
      try {
        const saved = await createEventoDb(userId, draft);
        updateState(p => ({ ...p, eventos: (p.eventos || []).map(e => e.id === tmpId ? saved : e) }));
      } catch (e) { console.error('createEvento failed:', e); }
    }
  };

  const remover = async (ev) => {
    updateState(prev => ({ ...prev, eventos: (prev.eventos || []).filter(e => e.id !== ev.id) }));
    if (userId && !String(ev.id).startsWith('tmp-')) {
      try { await deleteEventoDb(ev.id); }
      catch (e) { console.error('deleteEvento failed:', e); }
    }
  };

  // O que os eventos pedem hoje. Mesma funcao que o gerador de tarefa usa, pra
  // a tela nao discordar do que foi pra lista de Hoje.
  const hojePede = preparoDeHoje(eventos, hoje);

  return (
    <div className="section-gap flex flex-col">
      {hojePede.length > 0 && (
        <div className="card border-green-500/25 bg-green-500/[0.06] space-y-2">
          <p className="text-[13px] font-semibold text-green-300 flex items-center gap-2">
            <ListChecks size={14} aria-hidden="true" /> Hoje o preparo pede {hojePede.length}
          </p>
          <div className="space-y-1">
            {hojePede.map((i, k) => (
              <p key={k} className="text-[11px] text-zinc-300 leading-snug">{i.titulo}</p>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600">Ja estao na lista de Hoje. Fecha por lá.</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">Eventos com preparo</h3>
          <button onClick={() => setNovo({ nome: '' })} aria-label="Adicionar evento"
            className="text-[11px] text-green-400 hover:text-green-300 transition-colors min-h-[36px] px-2 flex items-center gap-1">
            <Plus size={12} aria-hidden="true" /> Adicionar
          </button>
        </div>

        {novo && (
          <div className="card-inner mb-5 space-y-3 animate-in">
            <input autoFocus placeholder="Nome do evento (ex: Gira, Festa de Cosme)"
              value={novo.nome} onChange={e => setNovo({ nome: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && criar()}
              autoComplete="off" className="input-base text-[13px]" />
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              O checklist de preparo (o que fazer 3 dias antes, 1 dia antes) se
              define em <span className="text-zinc-400">seed-coordenacao.sql</span>.
              Aqui você cuida das datas.
            </p>
            <div className="flex gap-2">
              <button onClick={criar} disabled={!novo.nome.trim()}
                className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-20 text-white py-2.5 rounded-xl text-xs font-medium transition-colors">
                Criar
              </button>
              <button onClick={() => setNovo(null)}
                className="px-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {eventos.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-6">
            Nenhum evento. A gira entra aqui, com as datas dela.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {eventos.map(ev => {
              const prox = proximaOcorrencia(ev, hoje);
              const dias = prox ? diasAte(prox, hoje) : null;
              const futuras = (ev.datas || []).filter(d => d >= hoje);
              return (
                <div key={ev.id} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CalendarClock size={14} className="text-green-400 shrink-0" aria-hidden="true" />
                    <span className="text-xs text-zinc-200 flex-1 truncate">{ev.nome}</span>
                    {prox ? (
                      <span className="text-[10px] text-zinc-500 shrink-0 tabular-nums">
                        {dias === 0 ? 'hoje' : `em ${dias}d`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-700 shrink-0">sem data</span>
                    )}
                    <button onClick={() => remover(ev)} aria-label={`Remover ${ev.nome}`}
                      className="text-zinc-700 hover:text-red-400 transition-colors w-7 h-7 flex items-center justify-center shrink-0">
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>

                  <p className="text-[10px] text-zinc-600 -mt-1">
                    {(ev.checklist || []).length === 0
                      ? 'Sem checklist: não gera tarefa nenhuma ainda.'
                      : `${ev.checklist.length} itens de preparo, do dia -${Math.max(...ev.checklist.map(i => i.diasAntes || 0))} ao dia 0.`}
                    {ev.recorrencia && ' · tem recorrência configurada'}
                  </p>

                  {futuras.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {futuras.map(d => (
                        <span key={d}
                          className="flex items-center gap-1 pl-2.5 pr-1 h-7 rounded-lg bg-zinc-800/60 text-[11px] text-zinc-300 tabular-nums">
                          {rotuloData(d)}
                          <button onClick={() => removeData(ev, d)} aria-label={`Remover ${rotuloData(d)} de ${ev.nome}`}
                            className="text-zinc-600 hover:text-red-400 transition-colors w-6 h-6 flex items-center justify-center">
                            <X size={10} aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input type="date" value={addData[ev.id] || ''} min={hoje}
                      onChange={e => setAddData(p => ({ ...p, [ev.id]: e.target.value }))}
                      aria-label={`Nova data para ${ev.nome}`}
                      className="input-base text-[12px] flex-1" />
                    <button onClick={() => addData_(ev)} disabled={!addData[ev.id]}
                      className="px-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-200 rounded-xl text-[11px] font-medium transition-colors min-h-[42px]">
                      Somar data
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
