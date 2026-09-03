import { useState, useEffect, useRef } from 'react';
import { X, Brain, Send, Loader2, Timer, Lightbulb } from 'lucide-react';
import {
  updateTopic as updateTopicDb,
  createRetrievalAttempt as createRetrievalAttemptDb,
  getDateKey,
} from '../store';
import { calculateNextReview } from '../lib/studyMethods';

// ==========================================================================
// RetrievalModal
// Walks the user through one retrieval-practice session on a single topic:
//   1. "Sem consultar, escreva o que você lembra" — textarea with a 2min timer
//   2. Self-rate 1-5 based on how well they actually remembered
//   3. A quick reflection prompt (Feynman if nailed it, "why hard?" if not)
//   4. Writes back: topic.confidence/status/next_review_at + retrieval_attempt
// ==========================================================================

// `status: null` = nao mexe no status do topico.
//
// Antes, nota 4 e 5 carimbavam `mastered`, e `mastered` tira o topico da conta
// de "quanto falta pra prova" em weekPlan.js. Ou seja: um "quase tudo, falhei
// um detalhe" numa noite boa reduzia os blocos daquela materia pelo resto do
// semestre. A literatura de calibracao diz que esse e o pior sinal possivel
// pra essa decisao: quem se superestima encerra o estudo cedo e a retencao cai,
// e a ma calibracao e mais forte justamente em quem ainda sabe menos (Koriat
// 1997; Dunlosky, Rawson, Kruger e Dunning).
//
// Agora auto-avaliacao alta so ESPACA a revisao (via next_review_at), que e
// reversivel: quando a revisao vence, o topico volta a contar como pendente.
// `mastered` passa a exigir acerto verificado, nao sensacao.
const RATING_META = {
  5: { label: 'Sabia sem titubear', status: null, color: 'bg-green-500', text: 'text-green-400' },
  4: { label: 'Quase tudo, falhei um detalhe', status: null, color: 'bg-emerald-500', text: 'text-emerald-400' },
  3: { label: 'Lembrei mais ou menos', status: 'difficulty', color: 'bg-amber-500', text: 'text-amber-400' },
  2: { label: 'Só fragmentos', status: 'difficulty', color: 'bg-orange-500', text: 'text-orange-400' },
  1: { label: 'Em branco', status: 'not_studied', color: 'bg-red-500', text: 'text-red-400' },
};

const PHASE_RECALL = 'recall';
const PHASE_RATE = 'rate';
const PHASE_REFLECT = 'reflect';

export default function RetrievalModal({ topic, subject, userId, onClose, onTopicUpdated }) {
  const [phase, setPhase] = useState(PHASE_RECALL);
  const [response, setResponse] = useState('');
  const [score, setScore] = useState(null);
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const textareaRef = useRef(null);
  const startAt = useRef(Date.now());

  useEffect(() => {
    // Start the stopwatch + focus the textarea
    textareaRef.current?.focus();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const submitRecall = () => setPhase(PHASE_RATE);
  const pickScore = (s) => { setScore(s); setPhase(PHASE_REFLECT); };

  const finish = async () => {
    if (!score) return;
    setSaving(true);
    const meta = RATING_META[score];
    const durationSec = Math.floor((Date.now() - startAt.current) / 1000);
    const nextReviewAt = calculateNextReview(score, topic.confidence || 0);
    // Optimistic patch for the parent state
    const topicPatch = {
      confidence: score,
      last_retrieval_at: new Date().toISOString(),
      // Sem lastStudied a cobertura em weekPlan.js nao reconhece a tentativa:
      // `coberto` pede os dois campos. Retrieval E estudo, e o mais util deles.
      lastStudied: getDateKey(),
      next_review_at: nextReviewAt,
      retrieval_count: (topic.retrieval_count || 0) + 1,
    };
    // status null = nota alta, nao carimba nada (ver RATING_META).
    if (meta.status) topicPatch.status = meta.status;
    if (score >= 4 && reflection.trim()) topicPatch.feynman_note = reflection.trim();
    if (score <= 3 && reflection.trim()) topicPatch.why_difficult = reflection.trim();

    onTopicUpdated?.(topicPatch); // parent updates local state

    try {
      if (typeof topic.id === 'string' && !topic.id.startsWith('tmp-')) {
        await updateTopicDb(topic.id, topicPatch);
        await createRetrievalAttemptDb(userId, {
          topicId: topic.id,
          subjectId: subject?.id,
          score,
          durationSec,
          responseText: response.trim() || null,
        });
      }
    } catch (e) {
      console.error('Retrieval save failed:', e);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const canSkipReflection = score !== null && score >= 4; // mastered — Feynman optional but encouraged
  const reflectionPrompt = score && score <= 3
    ? { label: 'Por que travou aqui? (1 frase)', placeholder: 'Ex: confundi a regra da cadeia com produto.', tone: 'text-amber-300' }
    : { label: 'Explique em 1 frase como se fosse pra um calouro (Feynman)', placeholder: 'Ex: é derivar a camada de fora, multiplicar pela derivada de dentro.', tone: 'text-emerald-300' };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-lg bg-[#18181b] border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl flex flex-col animate-in"
        style={{ maxHeight: 'min(92vh, 780px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
              <Brain size={16} className="text-indigo-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-zinc-500 truncate">{subject?.name}</p>
              <p className="text-sm font-semibold text-white truncate">{topic.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-500 tabular-nums flex items-center gap-1">
              <Timer size={11} aria-hidden="true" /> {fmtTime(elapsed)}
            </span>
            <button onClick={onClose} aria-label="Fechar"
              className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-white rounded-xl transition-colors -mr-2">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-7 pt-6 pb-8 flex-1">
          {phase === PHASE_RECALL && (
            <div className="space-y-4">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-indigo-300 mb-1">Retrieval Practice</p>
                <p className="text-[13px] text-zinc-200 leading-relaxed">
                  Sem consultar nada, escreva o que você lembra sobre <span className="font-semibold text-white">{topic.name}</span>. Fórmulas, ideias, exemplos — o que vier.
                </p>
                <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                  O esforço de puxar da memória — mesmo errando — é o que fixa. Reler é armadilha.
                </p>
              </div>
              <textarea ref={textareaRef} value={response} onChange={e => setResponse(e.target.value)}
                placeholder="Comece a escrever..." rows={8}
                className="input-base resize-none text-[13px] leading-relaxed" />
              <button onClick={submitRecall}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <Send size={14} aria-hidden="true" /> Enviar e me avaliar
              </button>
              <button onClick={onClose} className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors py-2">
                Cancelar (nao conta como tentativa)
              </button>
            </div>
          )}

          {phase === PHASE_RATE && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Agora, sinceramente: o quanto você acertou?
              </p>
              <div className="flex flex-col gap-2">
                {[5, 4, 3, 2, 1].map(s => {
                  const m = RATING_META[s];
                  return (
                    <button key={s} onClick={() => pickScore(s)}
                      className="flex items-center gap-4 px-4 py-3 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 text-left transition-colors min-h-[60px]">
                      <span className={`${m.color} w-8 h-8 rounded-lg text-white font-bold flex items-center justify-center shrink-0`}>
                        {s}
                      </span>
                      <span className="text-[13px] text-zinc-200 flex-1">{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setPhase(PHASE_RECALL)}
                className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors py-2">
                Voltar
              </button>
            </div>
          )}

          {phase === PHASE_REFLECT && score !== null && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 border ${score >= 4 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                <p className={`text-[11px] font-semibold mb-1 ${score >= 4 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {score >= 4 ? 'Bom. Cimenta com Feynman.' : 'Identifica onde travou.'}
                </p>
                <p className="text-[12px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <Lightbulb size={12} className={`shrink-0 mt-0.5 ${score >= 4 ? 'text-emerald-400' : 'text-amber-400'}`} aria-hidden="true" />
                  {score >= 4
                    ? 'Explicar em voz alta (ou por escrito) o conceito como se ensinasse alguem fixa o que voce tem.'
                    : 'Nomear a lacuna ja ajuda seu cerebro a procurar por ela da proxima vez.'}
                </p>
              </div>
              <label className={`text-[12px] font-medium block ${reflectionPrompt.tone}`}>
                {reflectionPrompt.label}
              </label>
              <textarea value={reflection} onChange={e => setReflection(e.target.value)}
                placeholder={reflectionPrompt.placeholder} rows={3}
                className="input-base resize-none text-[13px] leading-relaxed" />
              <div className="bg-zinc-800/40 rounded-lg px-3 py-2">
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Proxima revisao: <span className="text-zinc-300 font-medium">{describeInterval(score, topic.confidence || 0)}</span>
                </p>
              </div>
              <button onClick={finish} disabled={saving || (!canSkipReflection && !reflection.trim())}
                className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Salvando</> : <>Concluir</>}
              </button>
              {canSkipReflection && !reflection.trim() && (
                <p className="text-[10px] text-zinc-600 text-center">
                  Feynman e opcional quando voce ja domina, mas fixa muito mais.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function describeInterval(score, prevConfidence) {
  const map = { 1: 'amanha', 2: 'em 2 dias', 3: 'em 4 dias', 4: 'em 10 dias', 5: prevConfidence >= 4 ? 'em 6 semanas' : 'em 3 semanas' };
  return map[score] || 'amanha';
}
