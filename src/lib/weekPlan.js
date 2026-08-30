// ==========================================================================
// Planejador semanal. Roda no domingo e cobre domingo a sabado.
// As regras vivem em docs/METODOS.md — mudou la, muda aqui.
// Logica pura: nao toca banco, nao toca React. Testado em weekPlan.test.mjs.
// ==========================================================================
import { getDateKey } from './attendance.js';

export const BLOCO_MIN = 50;                 // um pomodoro longo
const DEFAULT_BUDGET = [240, 120, 120, 120, 120, 120, 240]; // dom..sab, em minutos

// Metodo por tipo de materia (docs/METODOS.md secao 2). O tipo sai do codigo
// da materia, porque e o que existe sem o usuario configurar nada.
const TIPOS = {
  EE400: 'matematica', MS211: 'matematica', EA513: 'matematica',
  MC404: 'programacao', MC621: 'programacao',
  MC426: 'projeto', MC919: 'projeto',
};
export const tipoDe = (subject) => TIPOS[subject.code] || 'matematica';

// Novo = fim de semana, quando ha cabeca pra conteudo inedito.
// Recuperacao = dia util, depois de 6h de CLT e ate 4h de aula.
const METODOS = {
  matematica: {
    novo: 'Worked example: leia 2 resolvidos explicando cada passo, faca 2 com o final apagado, depois 5 embaralhados sem consulta.',
    recuperacao: 'Practice testing: 5 problemas embaralhados de tipos diferentes, sem olhar solucao. Confira so no fim.',
  },
  programacao: {
    novo: 'PRIMM: preveja a saida antes de rodar, rode, trace linha a linha, modifique um trecho, so entao escreva do zero.',
    recuperacao: 'Parsons: pegue uma solucao sua, embaralhe as linhas e remonte. Depois trace a mao sem rodar.',
  },
  projeto: {
    novo: 'Marco: entenda o enunciado, divida com o grupo e combine data. Saia com um rascunho jogavel, nao com a versao final.',
    recuperacao: 'Avance um marco de 50min. Feche escrevendo em uma linha qual e o proximo passo.',
  },
};

// Peso por prazo (docs/METODOS.md regra 1). Prova amanha vale ~8x uma em 60 dias.
export function urgencia(subject, hoje) {
  const futuras = (subject.exams || [])
    .filter(e => e.date >= hoje && e.status !== 'feita')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!futuras.length) return { peso: 1, dias: null, alvo: null };
  const prox = futuras[0];
  const dias = Math.round((new Date(prox.date + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
  return { peso: 100 / (dias + 3), dias, alvo: prox };
}

// Hora ancora: a MESMA hora todo dia util, sempre que a aula deixar.
//
// Lally (2010) e Wood & Neal: automaticidade vem de repetir a resposta no mesmo
// contexto. Hora que muda todo dia (19h, 17h, 21h, 18h) nao vira habito, vira
// decisao nova toda noite — e decisao nova perde pro cansaco. Entao escolhemos
// uma ancora: a hora livre no maior numero de dias, e so desviamos onde a aula
// ocupa. O mesmo vale pro fim de semana, com sua propria ancora.
const CAND_UTIL = [19, 20, 21, 18, 17, 22, 16];
const CAND_FDS = [9, 10, 14, 15, 16, 17];

function ocupacaoDoDia(subject_list, date) {
  const dow = new Date(date + 'T12:00:00').getDay();
  const ocupado = [];
  for (const s of subject_list) {
    for (const sl of s.class_schedule || []) {
      if (sl.day !== dow || !sl.time) continue;
      const ini = Number(sl.time.slice(0, 2)) * 60 + Number(sl.time.slice(3, 5));
      ocupado.push([ini, ini + (sl.duration || 120)]);
    }
  }
  return ocupado;
}

const horaLivre = (ocupado, h) => {
  const ini = h * 60;
  return !ocupado.some(([a, b]) => ini < b && ini + BLOCO_MIN > a);
};

// Roda uma vez por semana: qual hora serve em mais dias?
function escolheAncora(subject_list, dias, fimDeSemana) {
  const cands = fimDeSemana ? CAND_FDS : CAND_UTIL;
  const alvo = dias.filter(d => {
    const dow = new Date(d + 'T12:00:00').getDay();
    return fimDeSemana === (dow === 0 || dow === 6);
  });
  if (!alvo.length) return cands[0];
  let melhor = cands[0], melhorN = -1;
  for (const h of cands) {
    const n = alvo.filter(d => horaLivre(ocupacaoDoDia(subject_list, d), h)).length;
    if (n > melhorN) { melhor = h; melhorN = n; }
  }
  return melhor;
}

// Horario do bloco: ancora primeiro, depois a hora seguinte, depois o resto.
function horarioLivre(subject_list, date, jaUsados, ancora) {
  const dow = new Date(date + 'T12:00:00').getDay();
  const fds = dow === 0 || dow === 6;
  const base = fds ? CAND_FDS : CAND_UTIL;
  const ordem = [ancora, ancora + 1, ...base.filter(h => h !== ancora && h !== ancora + 1)];
  const ocupado = ocupacaoDoDia(subject_list, date);
  for (const h of ordem) {
    if (h > 23 || jaUsados.has(h)) continue;
    if (!horaLivre(ocupado, h)) continue;
    jaUsados.add(h);
    return String(h).padStart(2, '0') + ':00';
  }
  return '';
}

// Escolhe o topico do bloco. Fim de semana puxa o que nunca foi estudado;
// dia util puxa o que ficou marcado como dificuldade, que e onde o retrieval
// rende mais. Topico ja usado nesta semana so volta se nao sobrar outro.
function escolheTopico(subject, novo, usados) {
  const topics = subject.topics || [];
  const livre = t => !usados.has(t.id);
  const ordem = novo
    ? [t => t.status === 'not_studied', t => t.status === 'difficulty', () => true]
    : [t => t.status === 'difficulty', t => t.status === 'not_studied', () => true];
  for (const filtro of ordem) {
    // Dentro do mesmo balde, o mais esquecido primeiro. Topico nunca tocado
    // (sem last_studied) vem antes de todos.
    const achou = topics.filter(t => filtro(t) && livre(t))
      .sort((a, b) => (a.last_studied || '').localeCompare(b.last_studied || ''))[0];
    if (achou) { usados.add(achou.id); return achou; }
  }
  return null;
}

/**
 * Monta o plano da semana que comeca em `inicio` (domingo, YYYY-MM-DD).
 * Devolve blocos de 50min: { date, time, subjectId, code, topic, kind, method, minutes }.
 *
 * budget: minutos disponiveis por dia da semana, indice 0=domingo.
 */
export function buildWeekPlan(subjects, inicio, budget = DEFAULT_BUDGET, ultimoEstudo = {}) {
  const ativas = (subjects || []).filter(s => (s.topics || []).length || (s.exams || []).length);
  if (!ativas.length) return [];

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return getDateKey(d);
  });

  // Quantos blocos cada dia comporta.
  const blocosPorDia = dias.map(d => {
    const dow = new Date(d + 'T12:00:00').getDay();
    return Math.floor((budget[dow] ?? 0) / BLOCO_MIN);
  });
  const totalBlocos = blocosPorDia.reduce((a, b) => a + b, 0);
  if (!totalBlocos) return [];

  // Cota por materia: proporcional a urgencia, com piso pra materia esquecida
  // ha 14 dias ou mais (docs/METODOS.md regra 2).
  const info = ativas.map(s => {
    const u = urgencia(s, inicio);
    const ult = ultimoEstudo[s.id];
    const esquecida = !ult || (new Date(inicio) - new Date(ult)) / 86400000 >= 14;
    return { s, ...u, piso: esquecida ? 1 : 0 };
  });
  const somaPeso = info.reduce((n, i) => n + i.peso, 0);
  let restante = totalBlocos;
  for (const i of info) { i.cota = i.piso; restante -= i.piso; }
  if (restante < 0) {  // piso ja estourou o orcamento: mais urgente fica
    info.sort((a, b) => b.peso - a.peso);
    let sobra = totalBlocos;
    for (const i of info) { i.cota = sobra > 0 ? 1 : 0; sobra -= i.cota; }
    restante = 0;
  } else {
    // Maior resto: distribui o inteiro e depois as sobras pelo maior residuo.
    const exato = info.map(i => (i.peso / somaPeso) * restante);
    info.forEach((i, k) => { i.cota += Math.floor(exato[k]); });
    const sobras = info
      .map((i, k) => ({ i, resto: exato[k] - Math.floor(exato[k]) }))
      .sort((a, b) => b.resto - a.resto);
    const falta = totalBlocos - info.reduce((n, i) => n + i.cota, 0);
    for (let k = 0; k < falta; k++) sobras[k % sobras.length].i.cota += 1;
  }

  // Distribuicao: em vez de encher dia a dia (o que empilha a materia urgente
  // toda no fim), cada bloco procura o dia mais cedo que ainda tem vaga e que
  // ainda nao recebeu aquela materia. E o que faz a regra 4 valer de verdade.
  info.sort((a, b) => b.peso - a.peso);
  // Ninguem leva mais blocos do que ha dias na semana (regra 4 impede dois
  // blocos da mesma materia no mesmo dia). O que sobra do teto volta pra fila.
  let sobrou = 0;
  for (const i of info) {
    if (i.cota > 7) { sobrou += i.cota - 7; i.cota = 7; }
  }
  while (sobrou > 0) {
    const alvo = info.find(i => i.cota < 7);
    if (!alvo) break;
    alvo.cota += 1; sobrou -= 1;
  }
  const bolsa = info.filter(i => i.cota > 0);

  // Distribuir dia a dia pegando sempre quem TEM MAIS blocos sobrando, e nunca
  // a mesma materia duas vezes no dia. Pegar "o mais urgente" em vez de "o que
  // tem mais sobrando" empilha a materia pesada no fim da semana e quebra a
  // regra 4 no sabado.
  const alocados = [];
  for (let d = 0; d < 7; d++) {
    const noDia = new Set();
    for (let b = 0; b < blocosPorDia[d]; b++) {
      const livres = bolsa.filter(x => x.cota > 0 && !noDia.has(x.s.id));
      const pool = livres.length ? livres : bolsa.filter(x => x.cota > 0);
      if (!pool.length) break;
      pool.sort((a, b2) => b2.cota - a.cota || b2.peso - a.peso);
      const escolhido = pool[0];
      escolhido.cota -= 1;
      noDia.add(escolhido.s.id);
      alocados.push({ d, entrada: escolhido });
    }
  }

  const ancoraUtil = escolheAncora(subjects, dias, false);
  const ancoraFds = escolheAncora(subjects, dias, true);

  const plano = [];
  const topicosUsados = new Set();
  for (let d = 0; d < 7; d++) {
    const date = dias[d];
    const dow = new Date(date + 'T12:00:00').getDay();
    const novo = dow === 0 || dow === 6;   // conteudo novo so no fim de semana
    const horasUsadas = new Set();
    for (const { entrada } of alocados.filter(a => a.d === d)) {
      const tipo = tipoDe(entrada.s);
      const topico = escolheTopico(entrada.s, novo, topicosUsados);
      plano.push({
        date,
        time: horarioLivre(subjects, date, horasUsadas, novo ? ancoraFds : ancoraUtil),
        subjectId: entrada.s.id,
        code: entrada.s.code || entrada.s.name,
        topic: topico?.name || null,
        topicId: topico?.id || null,
        kind: novo ? 'novo' : 'recuperacao',
        tipo,
        method: METODOS[tipo][novo ? 'novo' : 'recuperacao'],
        minutes: BLOCO_MIN,
        // Alvo recalculado NA DATA DO BLOCO: estudar quinta apontando pra prova
        // de terca e mentira. Depois da avaliacao o bloco passa a mirar a proxima.
        alvo: (() => {
          const u = urgencia(entrada.s, date);
          return u.alvo ? { name: u.alvo.name, date: u.alvo.date, dias: u.dias } : null;
        })(),
      });
    }
  }
  // Dentro do dia, ordem do relogio. Bloco sem horario vai pro fim.
  return plano.sort((a, b) =>
    a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99'));
}

// Titulo curto da tarefa que vai pro app.
export function tituloBloco(b) {
  const alvo = b.alvo ? ` (${b.alvo.name} em ${b.alvo.dias}d)` : '';
  return `${b.code}: ${b.topic || (b.kind === 'novo' ? 'conteudo novo' : 'revisao')}${alvo}`;
}
