import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Briefcase, Ban, MessageSquare, Paperclip, GitBranch, ExternalLink,
  Plus, X, Loader2, RefreshCw, ChevronRight,
} from 'lucide-react';
import { azureAction } from '../store';
import { FAZENDO, ordenaColunas } from '../lib/trabalho';

/**
 * O QUADRO DE TRABALHO.
 *
 * Ate 07/09/2026 as work items do Azure caiam direto no dia, misturadas com
 * estudo, casa e terreiro — ele nao escolhia nenhuma delas. Agora elas param
 * aqui, e so viram linha do dia quando ele move pra "fazendo".
 *
 * TUDO QUE ESTA TELA MOSTRA DE CONVERSA E ARQUIVO VEM DO AZURE NA HORA, e nada
 * disso e guardado aqui. Se fosse copia, ela divergiria no primeiro comentario
 * que alguem escrever pelo navegador do Azure, e o app passaria a mentir com
 * cara de certo. O que fica em cache e so o que a LISTA precisa desenhar.
 */

const corDoEstado = (e) => {
  const k = String(e).toLowerCase();
  if (FAZENDO.has(k)) return 'text-emerald-400 border-emerald-500/40';
  if (k === 'done' || k === 'closed') return 'text-zinc-500 border-zinc-700';
  return 'text-indigo-300 border-indigo-500/40';
};

function Detalhe({ card, onFechar, onMudou }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [comentario, setComentario] = useState('');
  const [subtarefa, setSubtarefa] = useState('');

  const carrega = useCallback(async () => {
    setCarregando(true); setErro('');
    try { setDados(await azureAction('get', { id: card.adoId })); }
    catch (e) { setErro(String(e.message || e)); }
    finally { setCarregando(false); }
  }, [card.adoId]);

  useEffect(() => { carrega(); }, [carrega]);

  // Toda acao segue o mesmo caminho: manda pro Azure, e so depois recarrega.
  // Pintar a tela antes da resposta faria ele ver "bloqueado" numa hora em que
  // o Azure recusou o campo — que e exatamente o que acontece no processo Agile.
  async function faz(rotulo, fn, recarregaLista = false) {
    setOcupado(rotulo); setErro('');
    try {
      await fn();
      await carrega();
      if (recarregaLista) await onMudou();
    } catch (e) { setErro(String(e.message || e)); }
    finally { setOcupado(''); }
  }

  const anexar = (arquivo) => faz('anexo', async () => {
    // FileReader devolve "data:tipo;base64,XXXX" — a funcao quer so o XXXX.
    const b64 = await new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.onerror = falha;
      r.readAsDataURL(arquivo);
    });
    await azureAction('attach', { id: card.adoId, name: arquivo.name, data: b64 });
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-zinc-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-5 py-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-xs text-zinc-500">#{card.adoId} · {card.tipo}</p>
            <h2 className="text-base font-medium leading-snug">{card.title.replace(/^#\d+\s*/, '')}</h2>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="text-zinc-500 p-1"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          {erro && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{erro}</p>}

          {/* ESTADO. Sem arrastar: isso aqui e um PWA de celular, e alvo de
              drag de 44px numa coluna estreita erra mais do que acerta. Botao
              tem o mesmo efeito e nao depende de pontaria. */}
          <section>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Estado</p>
            <div className="flex flex-wrap gap-2">
              {(card.estados?.length ? card.estados : [card.coluna]).map((e) => (
                <button
                  key={e}
                  disabled={!!ocupado || e === card.coluna}
                  onClick={() => faz('estado', () => azureAction('state', { id: card.adoId, state: e }), true)}
                  className={`text-sm px-3 py-1.5 rounded-full border ${
                    e === card.coluna ? 'bg-zinc-800 border-zinc-600 text-white' : `bg-transparent ${corDoEstado(e)}`
                  } disabled:opacity-60`}
                >
                  {e}
                </button>
              ))}
            </div>
            {FAZENDO.has(String(card.coluna).toLowerCase()) && (
              <p className="text-xs text-emerald-400/80 mt-2">Esta em andamento, entao aparece no seu dia.</p>
            )}
          </section>

          <section className="flex gap-2">
            <button
              disabled={!!ocupado}
              onClick={() => faz('bloqueio', () => azureAction('blocked', { id: card.adoId, blocked: !card.blocked }), true)}
              className={`flex-1 text-sm px-3 py-2 rounded-lg border flex items-center justify-center gap-2 ${
                card.blocked ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'border-zinc-700 text-zinc-400'
              }`}
            >
              <Ban size={15} /> {card.blocked ? 'Bloqueado' : 'Marcar bloqueado'}
            </button>
            <a href={dados?.web || card.url} target="_blank" rel="noreferrer"
               className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 flex items-center gap-2 text-sm">
              <ExternalLink size={15} /> Azure
            </a>
          </section>

          {carregando ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-zinc-600" /></div>
          ) : (
            <>
              <section>
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2">
                  <MessageSquare size={13} /> Conversa
                </p>
                <div className="space-y-2 mb-3">
                  {(dados?.comentarios || []).length === 0 && (
                    <p className="text-sm text-zinc-600">Ninguem comentou ainda.</p>
                  )}
                  {(dados?.comentarios || []).map((c) => (
                    <div key={c.id} className="card-inner">
                      <p className="text-xs text-zinc-500 mb-1">{c.autor}</p>
                      {/* O Azure devolve o comentario em HTML. Renderizar isso
                          seria abrir XSS num texto que qualquer pessoa do time
                          escreve, entao a tag vira texto e o conteudo aparece. */}
                      <p className="text-sm whitespace-pre-wrap">{String(c.texto || '').replace(/<[^>]+>/g, '')}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={comentario} onChange={(e) => setComentario(e.target.value)}
                    placeholder="Escrever no Azure..." className="input-base flex-1"
                  />
                  <button
                    disabled={!comentario.trim() || !!ocupado}
                    onClick={() => faz('comentario', async () => {
                      await azureAction('comment', { id: card.adoId, text: comentario });
                      setComentario('');
                    })}
                    className="px-3 rounded-lg bg-indigo-600 disabled:opacity-40"
                  >
                    {ocupado === 'comentario' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  </button>
                </div>
              </section>

              <section>
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2">
                  <GitBranch size={13} /> Subtarefas
                </p>
                {(dados?.filhos || []).length > 0 && (
                  <p className="text-sm text-zinc-400 mb-2">
                    {dados.filhos.length} no Azure: {dados.filhos.map((f) => `#${f}`).join(', ')}
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    value={subtarefa} onChange={(e) => setSubtarefa(e.target.value)}
                    placeholder="Nova subtarefa..." className="input-base flex-1"
                  />
                  <button
                    disabled={!subtarefa.trim() || !!ocupado}
                    onClick={() => faz('subtarefa', async () => {
                      await azureAction('subtask', { id: card.adoId, title: subtarefa });
                      setSubtarefa('');
                    })}
                    className="px-3 rounded-lg bg-indigo-600 disabled:opacity-40"
                  >
                    {ocupado === 'subtarefa' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  </button>
                </div>
                <p className="text-xs text-zinc-600 mt-2">
                  Nasce ligada a #{card.adoId} no Azure. Ela so vira card aqui quando for atribuida a voce e entrar na sprint.
                </p>
              </section>

              <section>
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2">
                  <Paperclip size={13} /> Anexos
                </p>
                {(dados?.anexos || []).map((a, i) => (
                  <p key={i} className="text-sm text-zinc-400">{a.nome}</p>
                ))}
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-indigo-400 cursor-pointer">
                  {ocupado === 'anexo' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Subir arquivo
                  <input type="file" className="hidden" disabled={!!ocupado}
                         onChange={(e) => e.target.files?.[0] && anexar(e.target.files[0])} />
                </label>
                <p className="text-xs text-zinc-600 mt-1">
                  Ate ~6 MB. Baixar e no Azure: o link exige a mesma credencial.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Trabalho({ state, onSync }) {
  const [aberto, setAberto] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  // O cache em disco de uma versao anterior do app nao tem `trabalho`.
  const cards = useMemo(() => state.trabalho || [], [state.trabalho]);
  const colunas = useMemo(() => ordenaColunas(cards), [cards]);

  async function sincroniza() {
    setSincronizando(true);
    try { await onSync(); } finally { setSincronizando(false); }
  }

  if (!cards.length) {
    return (
      <div className="card text-center py-10">
        <Briefcase size={26} className="mx-auto text-zinc-700 mb-3" />
        <p className="text-sm text-zinc-500">Nenhuma work item ativa na sprint corrente.</p>
        <button onClick={sincroniza} disabled={sincronizando}
                className="mt-4 text-sm text-indigo-400 inline-flex items-center gap-2">
          <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} /> Buscar no Azure
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{cards.length} na sprint corrente</p>
        <button onClick={sincroniza} disabled={sincronizando}
                className="text-sm text-indigo-400 inline-flex items-center gap-2">
          <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {colunas.map((col) => {
        const doGrupo = cards.filter((c) => c.coluna === col);
        if (!doGrupo.length) return null;
        return (
          <section key={col}>
            <p className={`text-xs uppercase tracking-wide mb-2 ${corDoEstado(col).split(' ')[0]}`}>
              {col} · {doGrupo.length}
            </p>
            <div className="space-y-2">
              {doGrupo.map((c) => (
                <button key={c.id} onClick={() => setAberto(c)}
                        className="card-inner w-full text-left flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{c.title.replace(/^#\d+\s*/, '')}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      #{c.adoId} · {c.tipo}{c.project ? ` · ${c.project}` : ''}
                    </p>
                  </div>
                  {c.blocked && <Ban size={15} className="text-amber-400 shrink-0" />}
                  <ChevronRight size={16} className="text-zinc-600 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {aberto && (
        <Detalhe
          card={cards.find((c) => c.adoId === aberto.adoId) || aberto}
          onFechar={() => setAberto(null)}
          onMudou={onSync}
        />
      )}
    </div>
  );
}
