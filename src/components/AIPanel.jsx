import { useState, useMemo } from 'react';
import { Brain, Sparkles, TrendingUp, AlertTriangle, Heart, BookOpen, Loader2, Clock } from 'lucide-react';
import { getDateKey, getSubjectStudyStats } from '../store';

export default function AIPanel({ state, updateState }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const today = getDateKey();
  const dayOfWeek = new Date().getDay();
  const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

  const stats = useMemo(() => {
    const todayTasks = state.tasks.filter(t => t.date === today);
    const doneTasks = todayTasks.filter(t => t.done);
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i); return getDateKey(d);
    });
    const weekTasks = state.tasks.filter(t => last7.includes(t.date));
    const weekDone = weekTasks.filter(t => t.done);

    const studyProgress = state.subjects.map(s => {
      const ss = getSubjectStudyStats(state.studySessions || [], s.id);
      const total = s.topics.length;
      const mastered = s.topics.filter(t => t.status === 'mastered').length;
      const difficulty = s.topics.filter(t => t.status === 'difficulty').length;
      return { ...ss, name: s.name, code: s.code, total, mastered, difficulty, progress: total > 0 ? Math.round((mastered / total) * 100) : 0 };
    });

    const waterDays = last7.filter(d => (state.water[d] || 0) * state.settings.bottleSize >= state.settings.waterGoal).length;
    const totalStudyMinutes = (state.studySessions || []).filter(s => last7.includes(s.date) && s.type === 'focus').reduce((sum, s) => sum + s.duration, 0);

    return {
      todayTotal: todayTasks.length, todayDone: doneTasks.length,
      weekTotal: weekTasks.length, weekDone: weekDone.length,
      studyProgress, waterDays, totalStudyMinutes,
      kanbanDoing: state.kanban.doing?.length || 0,
    };
  }, [state]);

  const generateAnalysis = () => {
    setLoading(true);
    setTimeout(() => {
      const insights = [], tips = [], risks = [];

      stats.studyProgress.forEach(s => {
        if (s.difficulty > 0) risks.push(`${s.name}: ${s.difficulty} topico(s) com dificuldade. Use active recall: tente explicar sem olhar o material.`);
        if (s.progress < 30 && s.total > 0) risks.push(`${s.name} esta com apenas ${s.progress}% dominado. Priorize nas proximas sessoes de Pomodoro.`);
        if (s.progress > 70) insights.push(`${s.name}: ${s.progress}% dominado! Mantenha revisoes leves com espacamento crescente.`);
        if (s.totalMinutes > 0) insights.push(`${s.name}: ${Math.floor(s.totalMinutes / 60)}h${s.totalMinutes % 60}m estudadas no total.`);
      });

      if (stats.weekTotal > 0) {
        const rate = Math.round((stats.weekDone / stats.weekTotal) * 100);
        if (rate > 80) insights.push(`Produtividade excelente: ${rate}% das tarefas concluidas na semana!`);
        else if (rate < 50) tips.push(`Taxa de conclusao de ${rate}% esta baixa. Reduza o numero de tarefas e foque no essencial.`);
      }

      if (stats.totalStudyMinutes > 0) {
        const avgPerDay = Math.round(stats.totalStudyMinutes / 7);
        if (avgPerDay < 60) tips.push(`Media de ${avgPerDay}min/dia de estudo. Para EC na Unicamp, tente pelo menos 2-3h/dia.`);
        else insights.push(`${Math.floor(stats.totalStudyMinutes / 60)}h de estudo na semana (${avgPerDay}min/dia). Bom ritmo!`);
      }

      if (stats.waterDays < 4) tips.push(`Meta de agua atingida em apenas ${stats.waterDays}/7 dias. Desidratacao reduz concentracao em ate 25%.`);
      else insights.push(`Hidratacao em dia: ${stats.waterDays}/7 dias na meta!`);

      if (stats.kanbanDoing > 3) tips.push(`${stats.kanbanDoing} tasks em andamento no trabalho. Limite o WIP (Work In Progress) para 2-3 tasks.`);

      const methods = [
        'Tecnica Feynman: explique o conceito como se ensinasse a alguem. Se travar, volte ao material. Ideal para EC.',
        'Active Recall: feche o material e tente lembrar. 40% mais eficaz que reler anotacoes.',
        'Interleaving: alterne materias a cada Pomodoro. Misturar assuntos melhora retencao de longo prazo.',
        'Espacamento 2357: revise em -18d, -7d, -5d, -3d, -2d antes da prova. Ja esta configurado automaticamente!',
        'Pratica Deliberada: resolva problemas que voce erra, nao os que ja sabe. Implemente os algoritmos em codigo.',
        'Elaborative Interrogation: para cada conceito, pergunte "por que isso funciona assim?" e tente responder.',
      ];

      const selfCare = [
        'Pausas de 10min caminhando entre Pomodoros melhoram a consolidacao de memoria.',
        'Durma 7-8h. A memoria de longo prazo se consolida durante o sono profundo.',
        'Exercicio aerobico 3x/semana aumenta o BDNF, proteina essencial para aprendizado.',
        'Tecnica 4-7-8 para ansiedade pre-prova: inspire 4s, segure 7s, expire 8s.',
      ];

      setAnalysis({
        insights, tips, risks,
        method: methods[Math.floor(Math.random() * methods.length)],
        selfCare: selfCare[Math.floor(Math.random() * selfCare.length)],
      });
      setLoading(false);
    }, 1200);
  };

  const generateSuggestions = () => {
    const sugs = [];

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const weakest = stats.studyProgress.filter(s => s.total > 0).sort((a, b) => a.progress - b.progress)[0];
      if (weakest) sugs.push({ title: `Estudar ${weakest.name} (${weakest.progress}% dominado)`, category: 'estudos', effort: '120' });
    }

    if (state.kanban.todo?.length > 0) {
      const highPrio = state.kanban.todo.find(t => t.priority === 'alta') || state.kanban.todo[0];
      sugs.push({ title: `Task: ${highPrio.title}`, category: 'trabalho', effort: highPrio.effort || '60' });
    }

    const difficultyTopics = state.subjects.flatMap(s => s.topics.filter(t => t.status === 'difficulty').map(t => ({ ...t, subject: s.name, subjectId: s.id })));
    if (difficultyTopics.length > 0) {
      const t = difficultyTopics[0];
      sugs.push({ title: `Revisar: ${t.name} (${t.subject})`, category: 'estudos', effort: '60' });
    }

    if (stats.waterDays < 4) sugs.push({ title: 'Beber agua regularmente', category: 'pessoal', effort: '30' });

    setSuggestions(sugs.slice(0, 3));
  };

  const acceptSuggestion = (sug) => {
    const task = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
      title: sug.title, category: sug.category, effort: sug.effort,
      time: '', done: false, date: today, recurring: false,
    };
    updateState(prev => ({ ...prev, tasks: [...prev.tasks, task] }));
    setSuggestions(prev => prev.filter(s => s.title !== sug.title));
  };

  return (
    <div className="section-gap animate-in">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-[10px] text-zinc-500">Hoje</p>
          <p className="text-lg font-bold text-white" aria-label={`${stats.todayDone} de ${stats.todayTotal} tarefas feitas hoje`}>{stats.todayDone}/{stats.todayTotal}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-zinc-500">Semana</p>
          <p className="text-lg font-bold text-white" aria-label={`${stats.weekDone} de ${stats.weekTotal} tarefas feitas na semana`}>{stats.weekDone}/{stats.weekTotal}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-zinc-500">Estudo</p>
          <p className="text-lg font-bold text-white flex items-center justify-center gap-1" aria-label={`${Math.floor(stats.totalStudyMinutes / 60)} horas de estudo`}>
            <Clock size={12} className="text-indigo-400" aria-hidden="true" />
            {Math.floor(stats.totalStudyMinutes / 60)}h
          </p>
        </div>
      </div>

      {/* Suggestions */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-400" aria-hidden="true" /> Sugestoes IA
          </h3>
          <button onClick={generateSuggestions} className="text-xs text-indigo-400 hover:text-indigo-300 min-h-[36px] px-3 transition-colors">
            Gerar
          </button>
        </div>

        {suggestions.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-4">Clique em "Gerar" para sugestoes personalizadas</p>
        ) : (
          <div className="space-y-2" aria-live="polite">
            {suggestions.map((sug, i) => (
              <div key={i} className="card-inner flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{sug.title}</p>
                  <span className={`tag tag-${sug.category} capitalize mt-1 inline-flex`}>{sug.category}</span>
                </div>
                <button onClick={() => acceptSuggestion(sug)} aria-label={`Aceitar sugestao: ${sug.title}`}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white text-xs px-4 rounded-lg transition-colors shrink-0 min-h-[44px]">
                  Aceitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analysis button */}
      <button onClick={generateAnalysis} disabled={loading}
        aria-busy={loading}
        className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-medium py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
      >
        {loading ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Analisando...</> : <><Brain size={16} aria-hidden="true" /> Analise Completa da Semana</>}
      </button>

      {analysis && (
        <div className="space-y-3 animate-in">
          {analysis.risks.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <h4 className="text-sm font-medium text-red-400 flex items-center gap-1.5 mb-2.5">
                <AlertTriangle size={14} /> Riscos
              </h4>
              <ul className="space-y-2">
                {analysis.risks.map((r, i) => <li key={i} className="text-xs text-zinc-300 leading-relaxed">{r}</li>)}
              </ul>
            </div>
          )}
          {analysis.insights.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <h4 className="text-sm font-medium text-green-400 flex items-center gap-1.5 mb-2.5">
                <TrendingUp size={14} /> Pontos positivos
              </h4>
              <ul className="space-y-2">
                {analysis.insights.map((r, i) => <li key={i} className="text-xs text-zinc-300 leading-relaxed">{r}</li>)}
              </ul>
            </div>
          )}
          {analysis.tips.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <h4 className="text-sm font-medium text-amber-400 flex items-center gap-1.5 mb-2.5">
                <Sparkles size={14} /> Dicas
              </h4>
              <ul className="space-y-2">
                {analysis.tips.map((r, i) => <li key={i} className="text-xs text-zinc-300 leading-relaxed">{r}</li>)}
              </ul>
            </div>
          )}
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
            <h4 className="text-sm font-medium text-violet-400 flex items-center gap-1.5 mb-2">
              <BookOpen size={14} /> Metodo de estudo
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">{analysis.method}</p>
          </div>
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-4">
            <h4 className="text-sm font-medium text-pink-400 flex items-center gap-1.5 mb-2">
              <Heart size={14} /> Autocuidado
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">{analysis.selfCare}</p>
          </div>
        </div>
      )}
    </div>
  );
}
