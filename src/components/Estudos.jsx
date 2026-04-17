import { useState, useRef, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, Plus, BookOpen, X, Calendar, FileText,
  AlertTriangle, Clock, Upload, FileUp, Loader2, Lightbulb,
  FlaskConical, Code2, Puzzle, PenLine, Ruler, Repeat, Rocket, Zap,
  Target, CheckCircle2, Timer, ClipboardCheck, Video, Link2,
  Brain, Shuffle, Flame,
} from 'lucide-react';
import {
  parseSyllabus, generateReviewSchedule, getSubjectStudyStats, getDateKey,
  createSubject as createSubjectDb, deleteSubject as deleteSubjectDb, dismissSubject as dismissSubjectDb,
  createTopic as createTopicDb, updateTopic as updateTopicDb, deleteTopic as deleteTopicDb,
  createExam as createExamDb,
} from '../store';
import {
  getTodayReviewQueue, generateInterleavedSession,
  getSubjectInCrunch, buildCrunchPlan,
} from '../lib/studyMethods';
import RetrievalModal from './RetrievalModal';

const statusConfig = {
  not_studied: { label: 'Nao estudei', bg: 'bg-zinc-700', text: 'text-zinc-300', next: 'difficulty' },
  difficulty: { label: 'Dificuldade', bg: 'bg-red-500/20', text: 'text-red-400', next: 'mastered' },
  mastered: { label: 'Dominado', bg: 'bg-green-500/20', text: 'text-green-400', next: 'not_studied' },
};

function getAdaptiveTips(subject, progress, stats) {
  const name = subject.name.toLowerCase();
  const diffTopics = subject.topics.filter(t => t.status === 'difficulty');
  const notStudied = subject.topics.filter(t => t.status === 'not_studied');
  const mastered = subject.topics.filter(t => t.status === 'mastered');
  const tips = [];

  if (/algoritmo|estrutura|dado|aed/i.test(name)) {
    if (diffTopics.length > 0) {
      tips.push({ Icon: FlaskConical, color: 'text-violet-400', title: 'Trace na mao', text: `Desenhe a memoria para ${diffTopics[0].name}. Trace cada ponteiro passo a passo ate entender o fluxo.` });
    }
    if (progress < 50) {
      tips.push({ Icon: Code2, color: 'text-indigo-400', title: 'Implemente em C', text: 'Code cada TAD do zero. Debugar te forca a entender ponteiros, malloc e alocacao.' });
    }
    if (mastered.length > 3) {
      tips.push({ Icon: Link2, color: 'text-cyan-400', title: 'Conecte conceitos', text: 'Implemente um projeto que combine estruturas: ex. grafo com hash table pra adjacencias.' });
    }
  } else if (/calculo|matematica|analise/i.test(name)) {
    tips.push({ Icon: PenLine, color: 'text-amber-400', title: 'Resolva 2-3x cada lista', text: 'Em calculo, fluencia > entendimento. Refaca problemas que errou ate acertar sem consultar.' });
    if (diffTopics.length > 0) {
      tips.push({ Icon: Video, color: 'text-pink-400', title: `Revise ${diffTopics[0].name}`, text: 'Assista aulas do 3Blue1Brown ou Khan Academy pro visual. Depois refaca exercicios.' });
    }
  } else if (/algebra|linear/i.test(name)) {
    tips.push({ Icon: Ruler, color: 'text-sky-400', title: 'Visualize espacos', text: 'Use 3Blue1Brown "Essence of Linear Algebra". Transformacoes lineares sao visuais.' });
  } else if (/fisica|mecanica|eletro/i.test(name)) {
    tips.push({ Icon: Ruler, color: 'text-sky-400', title: 'Formulario proprio', text: 'Monte seu formulario. Derive cada formula pra entender de onde vem.' });
    if (diffTopics.length > 0) {
      tips.push({ Icon: Repeat, color: 'text-violet-400', title: 'Problemas resolvidos', text: `Resolva 10 problemas de ${diffTopics[0].name} seguidos. Comece pelos mais faceis.` });
    }
  } else if (/logica|discreta|combinat/i.test(name)) {
    tips.push({ Icon: Puzzle, color: 'text-emerald-400', title: 'Tecnica Feynman', text: 'Explique cada prova/teorema como se ensinasse a alguem. Se travar, volte ao material.' });
  } else if (/programa|software|compil|sistema|so|rede/i.test(name)) {
    tips.push({ Icon: Code2, color: 'text-indigo-400', title: 'Projetos praticos', text: 'Implemente mini-projetos pra cada conceito. Em EC, codigo > teoria pra fixar.' });
  }

  if (progress === 0 && subject.topics.length > 0) {
    tips.push({ Icon: Rocket, color: 'text-indigo-400', title: 'Comece agora', text: `Voce tem ${subject.topics.length} topicos e nao comecou. Estude 1 topico hoje com Pomodoro de 25min.` });
  } else if (progress < 30 && progress > 0) {
    tips.push({ Icon: Zap, color: 'text-amber-400', title: 'Ganhe momentum', text: `${mastered.length}/${subject.topics.length} dominados. Foque nos ${notStudied.length} nao estudados antes dos dificeis.` });
  } else if (progress >= 30 && progress < 70) {
    tips.push({ Icon: Target, color: 'text-rose-400', title: 'Ataque os dificeis', text: `${diffTopics.length} topico(s) com dificuldade. Use Active Recall: feche o material e tente explicar.` });
  } else if (progress >= 70) {
    tips.push({ Icon: CheckCircle2, color: 'text-green-400', title: 'Revisao espacada', text: `${progress}% dominado! Revise a cada 3-5 dias pra nao esquecer. Foque nos ${diffTopics.length} restantes.` });
  }

  if (stats.totalMinutes > 0 && stats.totalMinutes < 60) {
    tips.push({ Icon: Timer, color: 'text-cyan-400', title: 'Mais tempo de estudo', text: `Apenas ${stats.totalMinutes}min estudados. Tente 2-3 Pomodoros por sessao.` });
  }
  if (stats.totalMinutes >= 300) {
    tips.push({ Icon: ClipboardCheck, color: 'text-violet-400', title: 'Hora de simular', text: `${Math.floor(stats.totalMinutes/60)}h de estudo. Faca um simulado cronometrado pra testar seu nivel.` });
  }

  return tips.slice(0, 3);
}

function urgencyMeta(d) {
  if (d < 7) return { label: 'Urgente', cls: 'urgency-high', Icon: AlertTriangle };
  if (d < 14) return { label: 'Em breve', cls: 'urgency-mid', Icon: Clock };
  return { label: 'Tranquilo', cls: 'urgency-low', Icon: Calendar };
}

// Load the pdf.js worker from the bundled package instead of a CDN — the
// old CDN path (cdnjs with pdfjsLib.version) can 404 for newer releases of
// pdfjs-dist, which fails silently and leaves the UI stuck on "Lendo...".
// Vite's `?url` suffix resolves the package path and returns a URL string.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

async function extractPdfText(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

export default function Estudos({ state, updateState, userId }) {
  const [expanded, setExpanded] = useState(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showSyllabus, setShowSyllabus] = useState(null);
  const [showAddExam, setShowAddExam] = useState(null);
  const [newSubject, setNewSubject] = useState({ name: '', code: '' });
  const [newTopic, setNewTopic] = useState('');
  const [newExam, setNewExam] = useState({ name: '', date: '' });
  const [syllabusText, setSyllabusText] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const fileRef = useRef(null);

  // Retrieval modal state: { topic, subject } when open, null when closed.
  // Also drives the interleaved session (queue of topics to cycle through).
  const [retrievalTarget, setRetrievalTarget] = useState(null);
  const [sessionQueue, setSessionQueue] = useState([]); // remaining pending picks
  const [crunchSubjectId, setCrunchSubjectId] = useState(null); // show plan for this subject

  // Memoized study-methods artifacts
  const todayQueue = useMemo(() => getTodayReviewQueue(state.subjects), [state.subjects]);
  const crunchInfo = useMemo(() => getSubjectInCrunch(state.subjects), [state.subjects]);
  const crunchSubject = crunchSubjectId
    ? state.subjects.find(s => s.id === crunchSubjectId)
    : crunchInfo?.subject;
  const crunchPlan = useMemo(() => {
    if (!crunchSubject || !crunchInfo) return null;
    return buildCrunchPlan(crunchSubject, crunchInfo.days);
  }, [crunchSubject, crunchInfo]);

  // Open a retrieval session for a specific topic (can be called mid-queue)
  const openRetrieval = (topic, subject) => setRetrievalTarget({ topic, subject });

  const startInterleavedSession = () => {
    const picks = generateInterleavedSession(state.subjects, 5);
    if (picks.length === 0) return;
    // Seed the queue with the tail; open the modal on the head
    const [head, ...rest] = picks;
    const subject = state.subjects.find(s => s.id === head.subjectId);
    const topic = subject?.topics.find(t => t.id === head.topicId);
    if (!subject || !topic) return;
    setSessionQueue(rest);
    setRetrievalTarget({ topic, subject });
  };

  const startTodayReview = () => {
    if (todayQueue.length === 0) return;
    const [head, ...rest] = todayQueue;
    const subject = state.subjects.find(s => s.id === head.subjectId);
    const topic = subject?.topics.find(t => t.id === head.topicId);
    if (!subject || !topic) return;
    // Convert remaining queue items to the same shape the modal chain uses
    setSessionQueue(rest.map(q => ({ topicId: q.topicId, subjectId: q.subjectId })));
    setRetrievalTarget({ topic, subject });
  };

  const advanceSession = () => {
    if (sessionQueue.length === 0) { setRetrievalTarget(null); return; }
    const [head, ...rest] = sessionQueue;
    const subject = state.subjects.find(s => s.id === head.subjectId);
    const topic = subject?.topics.find(t => t.id === head.topicId);
    setSessionQueue(rest);
    if (!subject || !topic) { setRetrievalTarget(null); return; }
    setRetrievalTarget({ topic, subject });
  };

  // Called by RetrievalModal with optimistic topic patch after a submission
  const applyRetrievalPatch = (topicId, subjectId, patch) => {
    updateState(p => ({ ...p, subjects: p.subjects.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: s.topics.map(t => t.id === topicId ? { ...t, ...patch } : t) };
    }) }));
  };

  const handlePdf = async (sid, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfError(null);
    setLoadingPdf(true);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) {
        setPdfError('PDF lido, mas nenhum texto foi extraido. Pode ser um PDF de imagens escaneadas (precisa OCR).');
        setSyllabusText('');
      } else {
        setSyllabusText(text);
        // Auto-open the syllabus textarea for this subject so the user sees the result
        setShowSyllabus(sid);
      }
    } catch (err) {
      console.error('PDF extraction failed:', err);
      setPdfError(`Nao foi possivel ler o PDF: ${err?.message || err}`);
      setSyllabusText('');
    } finally {
      setLoadingPdf(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // All mutations: optimistic local update, then sync to Supabase. On temp/real
  // id swap, we mutate the state again with the real id returned by the insert.
  const isTmp = (id) => typeof id === 'string' && id.startsWith('tmp-');

  const cycleStatus = (sid, topicId) => {
    let nextStatus = null;
    updateState(p => ({ ...p, subjects: p.subjects.map(s => {
      if (s.id !== sid) return s;
      return { ...s, topics: s.topics.map(t => {
        if (t.id !== topicId) return t;
        nextStatus = statusConfig[t.status].next;
        return { ...t, status: nextStatus };
      }) };
    }) }));
    if (isTmp(topicId) || !nextStatus) return;
    updateTopicDb(topicId, { status: nextStatus }).catch(e => console.error('cycleStatus sync failed:', e));
  };

  const getProgress = (s) => s.topics.length === 0 ? 0 : Math.round((s.topics.filter(t => t.status === 'mastered').length / s.topics.length) * 100);

  const addSubject = async () => {
    if (!newSubject.name.trim()) return;
    const tmpId = 'tmp-' + Date.now();
    const draft = {
      id: tmpId, name: newSubject.name.trim(), code: newSubject.code.trim(),
      syllabus: '', topics: [], exams: [], assignments: [],
    };
    updateState(p => ({ ...p, subjects: [...p.subjects, draft] }));
    setNewSubject({ name: '', code: '' }); setShowAddSubject(false);
    if (!userId) return;
    try {
      const saved = await createSubjectDb(userId, draft);
      updateState(p => ({ ...p, subjects: p.subjects.map(s => s.id === tmpId ? { ...s, id: saved.id } : s) }));
    } catch (e) {
      console.error('addSubject sync failed:', e);
    }
  };

  const addTopic = async (sid) => {
    if (!newTopic.trim()) return;
    const tmpId = 'tmp-' + Date.now();
    const draft = { id: tmpId, name: newTopic.trim(), status: 'not_studied', totalStudyMinutes: 0, lastStudied: null };
    updateState(p => ({ ...p, subjects: p.subjects.map(s => s.id !== sid ? s : { ...s, topics: [...s.topics, draft] }) }));
    setNewTopic('');
    if (!userId || isTmp(sid)) return;
    try {
      const saved = await createTopicDb(userId, sid, draft);
      updateState(p => ({ ...p, subjects: p.subjects.map(s => s.id !== sid ? s : {
        ...s, topics: s.topics.map(t => t.id === tmpId ? { ...t, id: saved.id } : t),
      }) }));
    } catch (e) {
      console.error('addTopic sync failed:', e);
    }
  };

  const addExam = async (sid) => {
    if (!newExam.name.trim() || !newExam.date) return;
    const tmpId = 'tmp-' + Date.now();
    const draft = { id: tmpId, name: newExam.name, date: newExam.date };
    updateState(p => ({ ...p, subjects: p.subjects.map(s => s.id !== sid ? s : { ...s, exams: [...s.exams, draft] }) }));
    setNewExam({ name: '', date: '' }); setShowAddExam(null);
    if (!userId || isTmp(sid)) return;
    try {
      const saved = await createExamDb(userId, sid, draft);
      updateState(p => ({ ...p, subjects: p.subjects.map(s => s.id !== sid ? s : {
        ...s, exams: s.exams.map(ex => ex.id === tmpId ? { ...ex, id: saved.id } : ex),
      }) }));
    } catch (e) {
      console.error('addExam sync failed:', e);
    }
  };

  const importSyllabus = async (sid) => {
    if (!syllabusText.trim()) return;
    const { topics, exams } = parseSyllabus(syllabusText);
    // Stamp each parsed item with a tmp id so we can swap it later
    const stampedTopics = topics.map((t, i) => ({ ...t, id: 'tmp-t-' + Date.now() + '-' + i }));
    const stampedExams = exams.map((e, i) => ({ ...e, id: 'tmp-e-' + Date.now() + '-' + i }));
    updateState(p => ({ ...p, subjects: p.subjects.map(s => s.id !== sid ? s : {
      ...s, syllabus: syllabusText,
      topics: [...s.topics, ...stampedTopics], exams: [...s.exams, ...stampedExams],
    }) }));
    setSyllabusText(''); setShowSyllabus(null);
    if (!userId || isTmp(sid)) return;
    // Insert sequentially so a partial failure still persists what worked
    for (const t of stampedTopics) {
      try {
        const saved = await createTopicDb(userId, sid, t);
        updateState(p => ({ ...p, subjects: p.subjects.map(s => s.id !== sid ? s : {
          ...s, topics: s.topics.map(x => x.id === t.id ? { ...x, id: saved.id } : x),
        }) }));
      } catch (e) { console.error('importSyllabus topic failed:', e); }
    }
    for (const ex of stampedExams) {
      try {
        const saved = await createExamDb(userId, sid, ex);
        updateState(p => ({ ...p, subjects: p.subjects.map(s => s.id !== sid ? s : {
          ...s, exams: s.exams.map(x => x.id === ex.id ? { ...x, id: saved.id } : x),
        }) }));
      } catch (e) { console.error('importSyllabus exam failed:', e); }
    }
  };

  const deleteTopic = (sid, topicId) => {
    updateState(p => ({ ...p, subjects: p.subjects.map(s => s.id !== sid ? s : {
      ...s, topics: s.topics.filter(t => t.id !== topicId),
    }) }));
    if (isTmp(topicId)) return;
    deleteTopicDb(topicId).catch(e => console.error('deleteTopic sync failed:', e));
  };

  const deleteSubject = (sid) => {
    // Subjects imported from Classroom (have classroom_course_id) get dismissed
    // so the next import doesn't re-create them. Manually-added subjects get
    // hard-deleted (cascades to topics/exams via FK).
    const subj = state.subjects.find(s => s.id === sid);
    const isImport = !!subj?.classroom_course_id;
    updateState(p => ({ ...p, subjects: p.subjects.filter(s => s.id !== sid) }));
    if (isTmp(sid)) return;
    const op = isImport ? dismissSubjectDb(sid) : deleteSubjectDb(sid);
    op.catch(e => console.error(isImport ? 'dismissSubject sync failed:' : 'deleteSubject sync failed:', e));
  };

  return (
    <div className="section-gap animate-in">
      {/* Crunch banner: loudest element when an exam is close and progress < 70% */}
      {crunchInfo && (
        <button onClick={() => setCrunchSubjectId(crunchInfo.subject.id)}
          className="w-full card !bg-red-500/10 !border-red-500/25 hover:!bg-red-500/15 transition-colors text-left">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
              <Flame size={18} className="text-red-400" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-red-300 leading-snug">
                Modo crunch: {crunchInfo.subject.name}
              </p>
              <p className="text-[11px] text-red-400/70 mt-1 leading-relaxed">
                Prova em {crunchInfo.days}d · {crunchInfo.progress}% dominado. Toque para ver o plano priorizado.
              </p>
            </div>
            <ChevronDown size={14} className="text-red-400 shrink-0 mt-1" aria-hidden="true" />
          </div>
        </button>
      )}

      {/* Spaced-review queue: topics whose next_review_at has arrived */}
      {todayQueue.length > 0 && (
        <div className="card !bg-indigo-500/5 !border-indigo-500/15">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
              <Brain size={16} className="text-indigo-400" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-indigo-300">Revisar hoje ({todayQueue.length})</p>
              <p className="text-[11px] text-indigo-400/70 mt-0.5">
                Retrieval rapido — o esquecimento comeca hoje se voce nao tocar.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {todayQueue.slice(0, 4).map(q => (
              <button key={q.topicId}
                onClick={() => {
                  const subject = state.subjects.find(s => s.id === q.subjectId);
                  const topic = subject?.topics.find(t => t.id === q.topicId);
                  if (subject && topic) openRetrieval(topic, subject);
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 transition-colors text-left min-h-[44px]">
                <span className="text-[10px] text-zinc-500 font-medium tabular-nums shrink-0 w-[42px]">
                  {q.daysOverdue > 0 ? `${q.daysOverdue}d atraso` : 'hoje'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-zinc-200 truncate">{q.topicName}</p>
                  <p className="text-[10px] text-zinc-600 truncate">{q.subjectName}</p>
                </div>
                <Brain size={12} className="text-indigo-400 shrink-0" aria-hidden="true" />
              </button>
            ))}
            {todayQueue.length > 4 && (
              <p className="text-[10px] text-zinc-600 text-center pt-1">+ {todayQueue.length - 4} outros na fila</p>
            )}
          </div>
          <button onClick={startTodayReview}
            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-2.5 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2">
            <Brain size={13} aria-hidden="true" /> Iniciar fila de revisao
          </button>
        </div>
      )}

      {/* Interleaved session — cross-subject mix, proven better than blocked study */}
      {state.subjects.some(s => (s.topics || []).length > 0) && (
        <button onClick={startInterleavedSession}
          className="w-full card hover:bg-[#1f1f23] flex items-center gap-3 text-left transition-colors">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <Shuffle size={16} className="text-violet-400" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white">Sessao mista</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              5 topicos de materias diferentes em sequencia. Intercalar fixa melhor que blocos.
            </p>
          </div>
          <ChevronDown size={14} className="text-zinc-600 -rotate-90 shrink-0" aria-hidden="true" />
        </button>
      )}

      <button onClick={() => setShowAddSubject(true)}
        className="w-full card hover:bg-[#1f1f23] flex items-center justify-center gap-2 min-h-[52px] text-sm text-zinc-500 transition-colors">
        <Plus size={16} aria-hidden="true" /> Adicionar Materia
      </button>

      {showAddSubject && (
        <div className="card space-y-4 animate-in">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-white">Nova Materia</h3>
            <button onClick={() => setShowAddSubject(false)} aria-label="Fechar"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-white rounded-xl transition-colors"><X size={16} aria-hidden="true" /></button>
          </div>
          <label htmlFor="new-subject-name" className="sr-only">Nome da materia</label>
          <input id="new-subject-name" autoComplete="off" placeholder="Nome (ex: Calculo III)" value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} className="input-base" />
          <label htmlFor="new-subject-code" className="sr-only">Codigo da materia</label>
          <input id="new-subject-code" autoComplete="off" placeholder="Codigo (ex: MC202)" value={newSubject.code} onChange={e => setNewSubject(p => ({ ...p, code: e.target.value }))} className="input-base" />
          <button onClick={addSubject} className="w-full bg-violet-500 hover:bg-violet-400 text-white py-3 rounded-xl text-sm font-medium transition-colors">Adicionar</button>
        </div>
      )}

      {state.subjects.map(subject => {
        const progress = getProgress(subject);
        const isOpen = expanded === subject.id;
        const stats = getSubjectStudyStats(state.studySessions || [], subject.id);
        const nextExam = subject.exams.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
        const daysUntil = nextExam ? Math.ceil((new Date(nextExam.date) - new Date()) / 86400000) : null;
        const tips = getAdaptiveTips(subject, progress, stats);
        const urgency = daysUntil !== null ? urgencyMeta(daysUntil) : null;

        return (
          <div key={subject.id} className="card !p-0 overflow-hidden">
            <button onClick={() => setExpanded(isOpen ? null : subject.id)}
              aria-expanded={isOpen}
              aria-controls={`subject-${subject.id}-content`}
              className="w-full p-4 min-h-[64px] flex items-center gap-3 hover:bg-[#1f1f23] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-violet-400" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white leading-snug">{subject.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {subject.code && <span className="text-[11px] text-zinc-500">{subject.code}</span>}
                  {stats.sessionCount > 0 && <span className="text-[10px] text-indigo-400">{Math.floor(stats.totalMinutes/60)}h{stats.totalMinutes%60}m</span>}
                  {urgency && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${urgency.cls}`}>
                      <urgency.Icon size={10} aria-hidden="true" />
                      <span>Prova {daysUntil}d</span>
                      <span className="sr-only"> — {urgency.label}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-zinc-500 tabular-nums">{progress}%</span>
                {isOpen ? <ChevronUp size={16} className="text-zinc-500" aria-hidden="true" /> : <ChevronDown size={16} className="text-zinc-500" aria-hidden="true" />}
              </div>
            </button>

            <div className="px-6 -mt-1 mb-1" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso: ${progress}%`}>
              <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {isOpen && (
              <div id={`subject-${subject.id}-content`} className="px-6 pb-7 pt-6 space-y-8 animate-in">
                {daysUntil !== null && daysUntil < 7 && stats.totalMinutes < 120 && (
                  <div role="alert" className="bg-red-500/8 border border-red-500/15 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-medium text-red-300">Prova em {daysUntil} dias</p>
                      <p className="text-[11px] text-red-400/60 mt-1 leading-relaxed">Apenas {stats.totalMinutes}min estudados. Abra o Pomodoro e foque!</p>
                    </div>
                  </div>
                )}

                <div className="card-inner space-y-3">
                  <p className="text-xs font-medium text-zinc-300 flex items-center gap-2">
                    <FileUp size={14} className="text-violet-400" aria-hidden="true" /> Importar programa
                  </p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Envie o PDF ou cole o texto. Topicos e datas de prova serao extraidos.
                  </p>
                  <div className="flex gap-2">
                    <input type="file" ref={fileRef} accept=".pdf" aria-label="Enviar PDF do programa" onChange={(e) => handlePdf(subject.id, e)} className="hidden" />
                    <button onClick={() => fileRef.current?.click()} disabled={loadingPdf}
                      className="flex-1 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 rounded-xl min-h-[44px] text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                      {loadingPdf ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Lendo...</> : <><Upload size={13} aria-hidden="true" /> PDF</>}
                    </button>
                    <button onClick={() => setShowSyllabus(showSyllabus === subject.id ? null : subject.id)}
                      className="flex-1 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 rounded-xl min-h-[44px] text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                      <FileText size={13} aria-hidden="true" /> Texto
                    </button>
                  </div>
                  {pdfError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 flex items-start gap-2">
                      <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="text-[11px] text-red-300 leading-relaxed">{pdfError}</p>
                    </div>
                  )}
                  {(showSyllabus === subject.id || syllabusText) && (
                    <div className="space-y-2 animate-in">
                      <label htmlFor={`syllabus-${subject.id}`} className="sr-only">Texto do programa</label>
                      <textarea id={`syllabus-${subject.id}`} placeholder="Cole o programa/ementa aqui..." value={syllabusText}
                        onChange={e => setSyllabusText(e.target.value)} rows={4} className="input-base resize-none text-[13px] leading-relaxed" />
                      <button onClick={() => importSyllabus(subject.id)} disabled={!syllabusText.trim()}
                        className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-20 text-white py-2.5 rounded-xl text-xs font-medium transition-colors">
                        Gerar topicos
                      </button>
                    </div>
                  )}
                </div>

                <div className="card-inner">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-xs font-semibold text-zinc-300 flex items-center gap-2"><Calendar size={12} aria-hidden="true" /> Provas</p>
                    <button onClick={() => setShowAddExam(showAddExam === subject.id ? null : subject.id)}
                      className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors min-h-[36px] px-2">+ Adicionar</button>
                  </div>
                  {showAddExam === subject.id && (
                    <div className="space-y-2 mb-4 animate-in">
                      <label htmlFor={`exam-name-${subject.id}`} className="sr-only">Nome da prova</label>
                      <input id={`exam-name-${subject.id}`} autoComplete="off" placeholder="Nome da prova" value={newExam.name} onChange={e => setNewExam(p => ({ ...p, name: e.target.value }))} className="input-base text-[13px]" />
                      <div className="flex gap-2">
                        <label htmlFor={`exam-date-${subject.id}`} className="sr-only">Data da prova</label>
                        <input id={`exam-date-${subject.id}`} type="date" value={newExam.date} onChange={e => setNewExam(p => ({ ...p, date: e.target.value }))} className="input-base text-[13px] flex-1" />
                        <button onClick={() => addExam(subject.id)} className="bg-violet-500 text-white px-5 rounded-xl text-xs hover:bg-violet-400 transition-colors min-h-[44px]">OK</button>
                      </div>
                    </div>
                  )}
                  {subject.exams.length === 0 && <p className="text-[11px] text-zinc-600">Nenhuma prova cadastrada</p>}
                  {subject.exams.map((exam, i) => {
                    const d = Math.ceil((new Date(exam.date) - new Date()) / 86400000);
                    const reviews = generateReviewSchedule(exam.date);
                    const u = urgencyMeta(d);
                    return (
                      <div key={i} className="card-inner mb-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] text-white font-medium">{exam.name}</span>
                          <span className={`text-xs font-bold shrink-0 inline-flex items-center gap-1 ${u.cls}`}>
                            <u.Icon size={11} aria-hidden="true" />
                            {new Date(exam.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} ({d}d)
                            <span className="sr-only"> — {u.label}</span>
                          </span>
                        </div>
                        {reviews.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            <span className="text-[10px] text-zinc-600">Revisoes:</span>
                            {reviews.map((r, j) => {
                              const today = r === getDateKey();
                              return <span key={j} className={`text-[10px] px-2 py-0.5 rounded-md ${today ? 'bg-violet-500/25 text-violet-300 font-bold' : 'bg-zinc-800/60 text-zinc-600'}`}>
                                {new Date(r+'T12:00').toLocaleDateString('pt-BR', { day:'numeric', month:'short' })}
                              </span>;
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="card-inner">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-xs font-semibold text-zinc-300 flex items-center gap-2"><FileText size={12} aria-hidden="true" /> Topicos ({subject.topics.length})</p>
                    {subject.topics.length > 0 && (
                      <span className="text-[10px] text-zinc-600">
                        {subject.topics.filter(t => t.status === 'mastered').length} dom. / {subject.topics.filter(t => t.status === 'difficulty').length} dif.
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {subject.topics.map((topic, idx) => {
                      const sc = statusConfig[topic.status];
                      const conf = topic.confidence || 0;
                      return (
                        <div key={topic.id ?? idx} className="flex items-start gap-3 py-2">
                          {/* Status pill: quick-cycle bypass when you just want to mark */}
                          <button onClick={() => cycleStatus(subject.id, topic.id)}
                            aria-label={`${topic.name}: ${sc.label}. Clique para mudar status sem retrieval.`}
                            className={`${sc.bg} ${sc.text} px-2.5 rounded-md text-[10px] font-medium w-[94px] min-h-[36px] text-center shrink-0 transition-colors hover:opacity-80 flex items-center justify-center`}>
                            {sc.label}
                          </button>
                          {/* Topic name: primary action → retrieval practice.
                              Wraps to multiple lines instead of truncating so
                              long topic names stay readable. */}
                          <button onClick={() => openRetrieval(topic, subject)}
                            aria-label={`Fazer retrieval de ${topic.name}`}
                            className="text-[13px] text-zinc-300 flex-1 leading-snug text-left hover:text-white transition-colors min-w-0 min-h-[36px] flex items-start gap-2 py-[6px]">
                            <Brain size={11} className="text-indigo-400/70 shrink-0 mt-[3px]" aria-hidden="true" />
                            <span className="break-words whitespace-normal">{topic.name}</span>
                          </button>
                          {conf > 0 && (
                            <span className="text-[10px] font-bold tabular-nums shrink-0"
                              style={{ color: conf >= 4 ? '#4ade80' : conf >= 3 ? '#fbbf24' : '#f87171' }}
                              aria-label={`Confianca ${conf} de 5`}>
                              {conf}/5
                            </span>
                          )}
                          <button onClick={() => deleteTopic(subject.id, topic.id)} aria-label={`Remover topico ${topic.name}`}
                            className="text-zinc-700 hover:text-red-400 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"><X size={13} aria-hidden="true" /></button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 mt-6 pt-5 border-t border-zinc-800/60">
                    <label htmlFor={`new-topic-${subject.id}`} className="sr-only">Novo topico</label>
                    <input id={`new-topic-${subject.id}`} autoComplete="off" placeholder="Novo topico..." value={newTopic} onChange={e => setNewTopic(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTopic(subject.id)} className="input-base flex-1 text-[13px]" />
                    <button onClick={() => addTopic(subject.id)} aria-label="Adicionar topico"
                      className="bg-violet-500/15 text-violet-400 w-12 rounded-xl text-base hover:bg-violet-500/25 transition-colors min-h-[48px] flex items-center justify-center shrink-0">
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {tips.length > 0 && (
                  <div className="card-inner !bg-indigo-500/5 border border-indigo-500/10">
                    <p className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5 mb-5">
                      <Lightbulb size={12} aria-hidden="true" /> Recomendacoes para voce
                    </p>
                    <div className="flex flex-col gap-4">
                      {tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <tip.Icon size={14} className={`${tip.color} shrink-0 mt-0.5`} aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-[12px] text-zinc-200 font-medium leading-snug mb-1">{tip.title}</p>
                            <p className="text-[11px] text-zinc-500 leading-relaxed">{tip.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => deleteSubject(subject.id)}
                  className="text-[11px] text-red-500/40 hover:text-red-400 transition-colors min-h-[36px] flex items-center">Remover materia</button>
              </div>
            )}
          </div>
        );
      })}

      {/* Retrieval practice modal — chains through the session queue on close */}
      {retrievalTarget && (
        <RetrievalModal
          topic={retrievalTarget.topic}
          subject={retrievalTarget.subject}
          userId={userId}
          onTopicUpdated={(patch) => applyRetrievalPatch(retrievalTarget.topic.id, retrievalTarget.subject.id, patch)}
          onClose={() => {
            // If we're mid-session (interleaved or today-queue), auto-advance
            if (sessionQueue.length > 0) advanceSession();
            else setRetrievalTarget(null);
          }}
        />
      )}

      {/* Crunch plan detail modal */}
      {crunchSubjectId && crunchPlan && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={e => e.target === e.currentTarget && setCrunchSubjectId(null)}>
          <div className="w-full sm:max-w-md bg-[#18181b] border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl flex flex-col"
            style={{ maxHeight: 'min(90vh, 820px)' }}>
            <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-zinc-800/50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                  <Flame size={16} className="text-red-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-zinc-500">Plano de crunch · {crunchPlan.daysUntilExam}d para prova</p>
                  <p className="text-sm font-semibold text-white truncate">{crunchSubject?.name}</p>
                </div>
              </div>
              <button onClick={() => setCrunchSubjectId(null)} aria-label="Fechar"
                className="w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-white rounded-xl transition-colors -mr-2">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-7 pt-6 pb-8 flex-1 space-y-6">
              {crunchPlan.sections.map((section, i) => (
                section.topics.length > 0 && (
                  <div key={i} className="space-y-3">
                    <div>
                      <p className={`text-[12px] font-semibold ${
                        section.tone === 'urgent' ? 'text-red-300' :
                        section.tone === 'primary' ? 'text-indigo-300' : 'text-zinc-400'
                      }`}>
                        {i + 1}. {section.label} ({section.topics.length})
                      </p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">{section.method}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {section.topics.map(t => (
                        <button key={t.id}
                          onClick={() => {
                            setCrunchSubjectId(null);
                            openRetrieval(t, crunchSubject);
                          }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-left transition-colors min-h-[44px]">
                          <Brain size={11} className="text-indigo-400/70 shrink-0" aria-hidden="true" />
                          <span className="text-[12px] text-zinc-200 flex-1 truncate">{t.name}</span>
                          {t.confidence > 0 && (
                            <span className="text-[10px] font-bold tabular-nums shrink-0"
                              style={{ color: t.confidence >= 4 ? '#4ade80' : t.confidence >= 3 ? '#fbbf24' : '#f87171' }}>
                              {t.confidence}/5
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))}
              <div className="bg-zinc-800/40 rounded-lg p-3">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  <span className="font-semibold text-zinc-300">Dica:</span> intercale materias no mesmo dia e durma. Madrugar vira rendimento negativo no dia da prova.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
