// ==========================================================================
// Retorno: hora que entrou contra nota que saiu, por materia.
//
// POR QUE.
// O app media esforco (tarefa, pomodoro, retrieval) e media resultado (nota
// lancada em `exams.grade`), e nunca punha os dois na mesma tela. `grades.js`
// calcula a media da formula; nada olhava pro custo dela.
//
// Habito de estudo prediz nota de verdade: Crede e Kuncel acham que habitos e
// habilidades de estudo rivalizam com prova padronizada e nota anterior como
// preditores; Duckworth e Seligman acham autodisciplina explicando mais de duas
// vezes a variancia do QI em nota final.
//
// O QUE ISTO NAO E.
// Nao e correlacao e nao e causalidade. Sao ~17 notas num semestre, com 7
// materias de dificuldade diferente e professor diferente: nao da pra concluir
// nada estatistico, e por isso aqui nao tem coeficiente nenhum. Serve pra uma
// coisa so, que n=1 aguenta: flagrar descasamento GROSSO, materia que come hora
// e devolve pouco. A leitura fina fica com quem estudou.
// ==========================================================================
import { effectiveDone } from './gamification.js';
import { computeMedia } from './grades.js';

const APROVACAO = 5;   // Unicamp: aprovado com media >= 5,0

const mediana = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * @param subjects estado.subjects (com topics e exams)
 * @param tasks    estado.tasks
 * @returns lista por materia, ordenada por hora investida (maior primeiro)
 */
export function retornoPorMateria(subjects, tasks) {
  const lista = subjects || [];

  // topico -> materia. Bloco do planejador carrega topic_id, nao subject_id.
  const donoDoTopico = {};
  for (const s of lista) for (const t of s.topics || []) donoDoTopico[t.id] = s.id;

  const minutosPor = {};
  for (const t of tasks || []) {
    if (t.category !== 'estudos' || !effectiveDone(t)) continue;
    const sid = t.subject_id || (t.topic_id ? donoDoTopico[t.topic_id] : null);
    if (!sid) continue;   // bloco solto, sem materia: nao entra na conta de ninguem
    minutosPor[sid] = (minutosPor[sid] || 0) + (Number(t.effort) || 0);
  }

  const linhas = lista.map(s => {
    const exames = s.exams || [];
    const provas = exames.filter(e => (e.type || 'prova') === 'prova');
    const atividades = exames.filter(e => e.type === 'atividade');
    const lancadas = exames.filter(e => e.grade != null && isFinite(e.grade));
    const notas = lancadas.map(e => Number(e.grade));
    const minutos = minutosPor[s.id] || 0;

    // Media pela formula da materia quando ela existe; a formula e a regra real
    // de aprovacao e nao a media aritmetica. Sem formula, cai na aritmetica.
    const porFormula = s.grade_formula
      ? computeMedia(s.grade_formula, provas, atividades)
      : null;
    const mediaSimples = notas.length
      ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100
      : null;

    return {
      subjectId: s.id,
      code: s.code || s.name,
      name: s.name,
      minutos,
      horas: Math.round((minutos / 60) * 10) / 10,
      notas,
      lancadas: notas.length,
      avaliacoes: exames.length,
      mediaSimples,
      // null quando a formula ainda nao fecha (nota faltando) ou nao existe
      media: porFormula && porFormula.value != null ? Math.round(porFormula.value * 100) / 100 : null,
      erroFormula: porFormula?.error || null,
    };
  });

  // Descasamento grosso: hora acima da mediana E nota abaixo da aprovacao.
  // Exige nota lancada: sem nota nao ha retorno pra comparar, so custo.
  const medHoras = mediana(linhas.filter(l => l.minutos > 0).map(l => l.minutos));
  for (const l of linhas) {
    const nota = l.media ?? l.mediaSimples;
    l.atencao = !!(l.lancadas > 0 && nota != null && nota < APROVACAO && l.minutos > medHoras);
    // O oposto tambem interessa: rende sem comer hora. Serve pra ele saber onde
    // NAO precisa mexer, em vez de espalhar esforco parelho nas 7.
    l.rendendo = !!(l.lancadas > 0 && nota != null && nota >= APROVACAO && l.minutos <= medHoras);
  }

  return linhas.sort((a, b) => b.minutos - a.minutos);
}

/**
 * Uma linha de texto so, pro topo da tela: onde esta o descasamento.
 * Devolve null quando nao ha nada honesto a dizer ainda.
 */
export function resumoDoRetorno(subjects, tasks) {
  const linhas = retornoPorMateria(subjects, tasks);
  const comNota = linhas.filter(l => l.lancadas > 0);
  if (comNota.length < 2) return null;   // com uma nota nao se compara nada
  const atencao = linhas.filter(l => l.atencao);
  if (!atencao.length) return null;
  return atencao.map(l => ({
    code: l.code, horas: l.horas, nota: l.media ?? l.mediaSimples,
  }));
}
