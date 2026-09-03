// ==========================================================================
// Orcamento medido: o planejador para de acreditar no que foi declarado e
// passa a usar o que aconteceu.
//
// POR QUE.
// Buehler, Griffin e Ross mediram a falacia do planejamento em estudantes: a
// previsao erra pra baixo e continua errando **mesmo quando a pessoa sabe** que
// tarefa parecida demorou mais. O antidoto com evidencia e o reference class
// forecasting (Flyvbjerg): prever pela distribuicao do que ja aconteceu em vez
// de pela estimativa "de dentro".
//
// O organizador tinha o dado e nao usava. `weekBudget` devolvia 2h por dia util
// e 4h no fim de semana porque foi o que o Hunter DECLAROU, e o canon ja tinha
// tropecado nisso na mao ("descer o lixo reciclavel estava marcado como 30
// minutos", achado simulando 12 semanas). Aqui isso vira automatico.
//
// A regua e esforco CONCLUIDO, nao tempo de sessao: sessao de pomodoro nao tem
// task_id, entao amarrar sessao a bloco seria chute. Tarefa concluida tem
// esforco declarado e tem `effectiveDone`, que ja exige o pomodoro cumprido.
// ==========================================================================
import { effectiveDone } from './gamification.js';

export const BLOCO_MIN = 50;
const MIN_OBS = 2;        // menos de 2 observacoes no dia da semana = sem base
const SEMANAS = 4;        // janela: 4 semanas cheias

const shift = (s, n) => {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function mediana(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * Minutos de estudo que ele REALMENTE fecha, por dia da semana.
 *
 * @param tasks      lista de tarefas do estado
 * @param hoje       'YYYY-MM-DD'. Hoje nao entra na conta: o dia esta em curso.
 * @param declarado  array[7] do que ele diz ter (weekBudget), indice 0=domingo
 * @returns array[7] de minutos, pronto pra entrar no buildWeekPlan
 */
export function orcamentoMedido(tasks, hoje, declarado, semanas = SEMANAS) {
  const base = Array.isArray(declarado) ? declarado : [];
  const inicio = shift(hoje, -(semanas * 7));

  // minutos concluidos por data
  const porData = {};
  for (const t of tasks || []) {
    if (t.category !== 'estudos' || !t.date) continue;
    if (t.date < inicio || t.date >= hoje) continue;   // janela fechada, sem hoje
    porData[t.date] = porData[t.date] || 0;
    if (effectiveDone(t)) porData[t.date] += Number(t.effort) || 0;
  }

  // agrupa por dia da semana. So conta data que TEVE plano: dia sem nenhum
  // bloco criado nao e evidencia de que ele nao rende, e evidencia de que o
  // planejador nao passou ali.
  const porDow = [[], [], [], [], [], [], []];
  for (const [date, min] of Object.entries(porData)) {
    porDow[new Date(date + 'T12:00:00').getDay()].push(min);
  }

  return porDow.map((obs, dow) => {
    const teto = base[dow] ?? 0;
    if (obs.length < MIN_OBS) return teto;             // sem base, respeita o declarado
    const med = mediana(obs);
    // Piso de um bloco: orcamento zero apaga o plano do dia, e um app que para
    // de planejar depois de uma semana ruim e pior que um app otimista.
    // Teto no declarado: acima disso o app estaria inventando tempo que a CLT
    // e a aula nao deixam existir, e isso ele sabe e o app nao.
    return Math.min(teto, Math.max(BLOCO_MIN, med));
  });
}

/**
 * Quanto o declarado erra, por dia da semana. Serve pra mostrar na tela em vez
 * de corrigir em silencio: correcao invisivel viraria "o app encolheu meu dia".
 * Devolve so os dias com base suficiente.
 */
export function desvioDoDeclarado(tasks, hoje, declarado, semanas = SEMANAS) {
  const medido = orcamentoMedido(tasks, hoje, declarado, semanas);
  const out = [];
  for (let dow = 0; dow < 7; dow++) {
    const dec = declarado?.[dow] ?? 0;
    if (!dec || medido[dow] === dec) continue;
    out.push({ dow, declarado: dec, medido: medido[dow], delta: medido[dow] - dec });
  }
  return out;
}
