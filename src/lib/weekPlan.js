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

// Quando revisar o que acabou de ser estudado (docs/METODOS.md secao 3).
// Cepeda e colegas mediram em mais de 1350 pessoas: o intervalo otimo ate a
// primeira revisao fica entre 10% e 20% do tempo que falta pro teste. Usamos
// 15%, com piso de 1 dia (revisar no mesmo dia nao espaca nada) e teto de 21
// (mais que isso e esquecer antes de revisar).
export function intervaloCepeda(hoje, dataProva) {
  if (!dataProva) return null;
  const dias = Math.round((new Date(dataProva + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
  if (dias <= 0) return null;
  const gap = Math.min(21, Math.max(1, Math.round(dias * 0.15)));
  const d = new Date(hoje + 'T12:00:00');
  d.setDate(d.getDate() + gap);
  return getDateKey(d);
}

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

// Peso por TAXA EXIGIDA, nao por proximidade (docs/METODOS.md regra 1).
//
// Proximidade sozinha engana. A P1 de EE400 pede 6 topicos em 9 dias; a de
// EA513 pede 12 em 18. E a mesma taxa de 0,67 por dia, mas um peso 1/dias dava
// 1,7x mais blocos a EE400 e deixava EA513 chegar na prova com 8 de 12.
// O peso agora e "quanto conteudo por dia falta", que e o que a prova cobra.
export function urgencia(subject, hoje) {
  const futuras = (subject.exams || [])
    .filter(e => e.date >= hoje && e.status !== 'feita')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!futuras.length) return { peso: 1, dias: null, alvo: null };
  const prox = futuras[0];
  const dias = Math.round((new Date(prox.date + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
  const todos = subject.topics || [];
  const naFaixa = prox.covers_from != null
    ? todos.filter(t => t.position >= prox.covers_from && t.position <= prox.covers_to)
    : todos;
  // Pendente = o que ainda pede trabalho ANTES da prova. Duas correcoes que
  // sairam da simulacao de 12 semanas (02/09/2026):
  //
  // 1. `status !== 'mastered'` sozinho nunca caia. Concluir um bloco grava
  //    last_studied e next_review_at e NAO toca status, entao MS211 chegava a
  //    7 de 7 topicos estudados com o planejador ainda vendo 7 restantes. O
  //    peso da materia era calculado sobre um numero que nao se move.
  // 2. Topico com revisao VENCIDA volta a pendente. Antes, a revisao do Cepeda
  //    era escolhida na frente da fila (escolheTopico) mas a materia podia nao
  //    receber bloco nenhum naquele dia: so 25% das revisoes caiam no dia
  //    previsto, com atraso mediano de 4 dias. Contar a vencida como pendente
  //    faz a urgencia subir e o bloco aparecer, reusando a cota que ja existe
  //    em vez de abrir um caminho paralelo pra revisao.
  const coberto = (t) => t.status === 'mastered'
    || (t.lastStudied && t.next_review_at && t.next_review_at > hoje);
  const restantes = naFaixa.filter(t => !coberto(t)).length;
  // Sem topico pendente a materia entra em manutencao, nao some.
  const taxa = restantes ? (restantes / Math.max(dias, 1)) * 100 : 5;
  // Prazo de 2 dias ou menos ainda ganha um empurrao: cobrir vence distribuir.
  const colado = dias <= 2 ? 3 : 1;
  return { peso: taxa * colado, dias, alvo: prox, restantes };
}

// Hora ancora: a MESMA hora todo dia util, sempre que a aula deixar.
//
// Lally (2010) e Wood & Neal: automaticidade vem de repetir a resposta no mesmo
// contexto. Hora que muda todo dia (19h, 17h, 21h, 18h) nao vira habito, vira
// decisao nova toda noite — e decisao nova perde pro cansaco. Entao escolhemos
// uma ancora: a hora livre no maior numero de dias, e so desviamos onde a aula
// ocupa. O mesmo vale pro fim de semana, com sua propria ancora.
// As tres ultimas sao ultimo recurso: so entram em dia de crunch, quando a
// noite ja encheu. Acordar cedo custa, e o custo so se paga com prova amanha.
const CAND_UTIL = [19, 20, 21, 18, 17, 22, 16, 15, 10, 9, 8];
const HORA_MANHA = 8;
// 11h entra antes das tardes: com o terreiro comecando 16h no sabado, encher
// ate as 15h deixava 10 minutos pra sair. Tres blocos de manha e um a tarde
// abrem 70 minutos de folga antes do compromisso.
// 8h entra no fim de semana por causa da rampa de carga. Com o terreiro das
// 16h as 23h no sabado, os candidatos livres eram 9, 10, 11, 14 e 15: cinco.
// Um orcamento de 6 blocos criava um bloco SEM HORARIO, que e bloco que nao
// vira implementation intention nenhuma. Ele acorda as 7, entao 8h de sabado
// existe. Medido em 03/09/2026 na previa do plano com boost.
const CAND_FDS = [8, 9, 10, 11, 14, 15, 16, 17];

function ocupacaoDoDia(subject_list, date) {
  const dow = new Date(date + 'T12:00:00').getDay();
  const ocupado = [];
  for (const s of subject_list) {
    // Aula que ele nao vai nao ocupa a agenda: aquele horario vira estudo.
    if (s.attends === false) continue;
    // Feriado e dia sem aula tambem nao ocupam. O dado ja existia em
    // skip_dates (MC404 e MC919 tem 2026-09-07 desde o seed) e esta funcao
    // nunca leu: num feriado o planejador continuava achando que a aula das
    // 14h e das 21h estavam ocupadas, e perdia justamente o dia livre.
    if ((s.skip_dates || []).includes(date)) continue;
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

// Todos os horarios do dia de uma vez, DEVOLVIDOS EM ORDEM DE RELOGIO.
// Escolher um por vez e depois ordenar inverte o conteudo: a vespera da A1
// saia com U4 as 16h e U0 as 18h, ou seja, estudando de tras pra frente.
function horariosDoDia(subject_list, date, n, ancora, manha) {
  if (n <= 0) return [];
  const dow = new Date(date + 'T12:00:00').getDay();
  const fds = dow === 0 || dow === 6;
  const base = fds ? CAND_FDS : CAND_UTIL;
  const ordem = manha
    ? [HORA_MANHA, ancora, ancora + 1, ...base.filter(h => h !== ancora && h !== ancora + 1)]
    : [ancora, ancora + 1, ...base.filter(h => h !== ancora && h !== ancora + 1)];
  const ocupado = ocupacaoDoDia(subject_list, date);
  const achadas = [];
  for (const h of ordem) {
    if (achadas.length >= n) break;
    if (h > 23 || achadas.includes(h)) continue;
    if (horaLivre(ocupado, h)) achadas.push(h);
  }
  return achadas.sort((a, b) => a - b).map(h => String(h).padStart(2, '0') + ':00');
}

// Escolhe o topico do bloco. Fim de semana puxa o que nunca foi estudado;
// dia util puxa o que ficou marcado como dificuldade, que e onde o retrieval
// rende mais. Topico ja usado nesta semana so volta se nao sobrar outro.
function escolheTopico(subject, novo, usados, alvo, hoje) {
  const todos = subject.topics || [];
  if (!todos.length) return null;
  // A prova manda no assunto, nao so na urgencia. A P1 de EE400 cobre a Parte I
  // (positions 10-19); estudar Series (30-39) na semana dela e trabalho jogado
  // fora. Quando a faixa acaba, o bloco REVISA dentro dela em vez de sair:
  // retrieval no conteudo que cai vale mais que conteudo novo que nao cai.
  const naFaixa = (alvo && alvo.covers_from != null)
    ? todos.filter(t => t.position >= alvo.covers_from && t.position <= alvo.covers_to)
    : [];
  const pool = naFaixa.length ? naFaixa : todos;

  // Revisao vencida vem antes de conteudo novo, em qualquer dia. Practice
  // testing e distributed practice sao as duas tecnicas de utilidade ALTA
  // (Dunlosky); aprender assunto novo por cima de revisao atrasada troca a
  // tecnica boa pela media.
  const vencida = t => t.next_review_at && t.next_review_at <= hoje;
  const nunca = t => !t.lastStudied;
  // DIA DE CONTEUDO NOVO (fim de semana e manha liberada): topico NUNCA visto
  // vem antes de revisao vencida. Dia de recuperacao (noite de dia util):
  // revisao vencida vem antes.
  //
  // POR QUE a inversao, medido em 03/09/2026: com a prova em 13 dias o
  // intervalo do Cepeda da 2 dias, entao revisao vence a cada 2 dias e come a
  // capacidade. A EA513 recebia 14 blocos em 14 dias e cobria 7 dos 12 topicos
  // da prova, re-revisando os mesmos 7 — 5 topicos chegariam na prova sem
  // NENHUMA exposicao.
  //
  // A regra 5 do canon ("revisao vencida antes de conteudo novo") vem do
  // Dunlosky, e esta certa: practice testing rende mais que exposicao. Mas ela
  // pressupoe que a cobertura existe. Nao se revisa o que nao se aprendeu, e
  // ponto que nunca foi visto esta perdido de qualquer forma. Entao a
  // precedencia se divide por tipo de dia em vez de valer sempre.
  const ordem = novo
    ? [nunca, vencida, t => t.status === 'difficulty', () => true]
    : [vencida, t => t.status === 'difficulty', nunca, () => true];
  for (const filtro of ordem) {
    // Dentro do mesmo balde, o mais esquecido primeiro. Topico nunca tocado
    // (sem lastStudied) vem antes de todos.
    const achou = pool.filter(t => filtro(t) && !usados.has(t.id))
      .sort((a, b) => (a.lastStudied || '').localeCompare(b.lastStudied || ''))[0];
    if (achou) { usados.add(achou.id); return achou; }
  }
  // Faixa esgotada na semana: repete o mais esquecido dela como revisao.
  return pool.slice().sort((a, b) => (a.lastStudied || '').localeCompare(b.lastStudied || ''))[0] || null;
}

/**
 * Monta o plano da semana que comeca em `inicio` (domingo, YYYY-MM-DD).
 * Devolve blocos de 50min: { date, time, subjectId, code, topic, kind, method, minutes }.
 *
 * budget: minutos disponiveis por dia da semana, indice 0=domingo.
 */
export function buildWeekPlan(subjects, inicio, budget = DEFAULT_BUDGET, ultimoEstudo = {}, morningDays = [], lugar = '') {
  const ativas = (subjects || []).filter(s => (s.topics || []).length || (s.exams || []).length);
  if (!ativas.length) return [];

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return getDateKey(d);
  });

  // Quantos blocos cada dia comporta. `budget` aceita array por dia da semana
  // OU funcao (date) -> minutos. A funcao existe pra rampa de carga com data de
  // fim: uma semana que atravessa o fim do boost tem dias com orcamento
  // diferente, e um array indexado por dia da semana nao sabe expressar isso.
  const blocosPorDia = dias.map(d => Math.floor(orcamentoDe(budget, d) / BLOCO_MIN));
  const totalBlocos = blocosPorDia.reduce((a, b) => a + b, 0);
  if (!totalBlocos) return [];

  // Cota por materia: proporcional a urgencia, com piso pra materia esquecida
  // ha 14 dias ou mais (docs/METODOS.md regra 2).
  // Revisao vencida precisa de COTA, nao so de prioridade na fila.
  // escolheTopico ja punha a vencida na frente, mas so entre os blocos que a
  // materia recebeu. Materia com cota zero na semana nunca revisava. Medido em
  // 12 semanas: 25% das revisoes caiam no dia previsto. O canon manda "revisao
  // vencida entra no topo da fila, antes de conteudo novo", e piso e o mecanismo
  // que a casa ja usa pra garantir bloco. Reuso dele em vez de um caminho novo.
  const temVencida = (s, hoje) =>
    (s.topics || []).some(t => t.next_review_at && t.next_review_at <= hoje);
  const info = ativas.map(s => {
    const u = urgencia(s, inicio);
    const ult = ultimoEstudo[s.id];
    const esquecida = !ult || (new Date(inicio) - new Date(ult)) / 86400000 >= 14;
    const vencida = temVencida(s, inicio);
    return { s, ...u, piso: (esquecida || vencida) ? 1 : 0 };
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
    // Teto de 7: regra 4 impede dois blocos da mesma materia no mesmo dia.
    // Teto de topicos: mais blocos que topicos produz bloco sem assunto, que e
    // o "estudar EE400" vago que Locke e Latham derrubam.
    //
    // TENTEI SUBIR ESTE TETO em 03/09/2026, pra materia em crunch nao gastar a
    // cota antes da vespera. Piorou: com o teto em 12, a EE400 despejou 8
    // blocos no feriado e escolheTopico caiu no fallback de "faixa esgotada",
    // repetindo O MESMO topico 5 vezes. Sete blocos com 6 topicos distintos
    // valem mais que doze com repeticao. Revertido.
    const teto = Math.min(7, (i.s.topics || []).length || 7);
    if (i.cota > teto) { sobrou += i.cota - teto; i.cota = teto; }
  }
  while (sobrou > 0) {
    const alvo = info.find(i => i.cota < Math.min(7, (i.s.topics || []).length || 7));
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
      // Regra 4 (uma materia por dia) cede quando a avaliacao e hoje ou amanha:
      // com prazo colado, cobrir o conteudo vence distribuir o esforco. A
      // urgencia e medida na data DO DIA, senao o crunch vazaria pra semana toda.
      // Prova a 2 dias ou menos abre a regra 4 (uma materia por dia). Era 1 dia.
      // Com 1, a vespera-da-vespera virava dia espalhado entre 7 materias, e e
      // exatamente o dia que deveria ser fundo numa so — ainda mais quando cai
      // num feriado, que e o unico dia inteiro livre da semana.
      const crunch = bolsa.filter(x => {
        if (x.cota <= 0) return false;
        const u = urgencia(x.s, dias[d]);
        return u.dias !== null && u.dias <= 2;
      });
      const livres = bolsa.filter(x => x.cota > 0 && !noDia.has(x.s.id));
      // Ordem de precedencia no dia: avaliacao colada > revisao vencida NAQUELE
      // dia > resto. A vencida vem antes de conteudo novo porque practice
      // testing e distributed practice sao as duas tecnicas de utilidade ALTA
      // (Dunlosky); adiar a revisao pra aprender assunto novo troca a boa pela
      // media. Medido NA DATA DO DIA, nao na data de inicio da semana.
      const vencidas = livres.filter(x =>
        (x.s.topics || []).some(t => t.next_review_at && t.next_review_at <= dias[d]));
      const pool = crunch.length ? crunch
        : (vencidas.length ? vencidas
          : (livres.length ? livres : bolsa.filter(x => x.cota > 0)));
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
    const fds = dow === 0 || dow === 6;
    // Manha liberada: o primeiro bloco do dia vai as 8h e leva conteudo novo,
    // porque antes do trabalho a cabeca rende pra aprender. Ele SUBSTITUI um
    // bloco da noite, nao soma: o orcamento da semana continua o mesmo.
    const temManha = morningDays.includes(dow) && !fds;
    const doDia = alocados.filter(a => a.d === d);
    const horarios = horariosDoDia(subjects, date, doDia.length,
      fds ? ancoraFds : ancoraUtil, temManha);
    let idx = 0;
    for (const { entrada } of doDia) {
      const hora = horarios[idx] || '';
      const naManha = temManha && idx === 0 && hora === '08:00';
      idx++;
      const novo = fds || naManha;
      const tipo = tipoDe(entrada.s);
      const uDia = urgencia(entrada.s, date);
      const topico = escolheTopico(entrada.s, novo, topicosUsados, uDia.alvo, date);
      plano.push({
        date,
        time: hora,
        subjectId: entrada.s.id,
        code: entrada.s.code || entrada.s.name,
        topic: topico?.name || null,
        topicId: topico?.id || null,
        // Revisao vencida troca o metodo: retrieval, nao exposicao.
        kind: (topico?.next_review_at && topico.next_review_at <= date)
          ? 'revisao' : (novo ? 'novo' : 'recuperacao'),
        tipo,
        method: (topico?.next_review_at && topico.next_review_at <= date)
          ? 'Retrieval: feche o material e escreva de memoria o conceito e um exemplo. So depois confira, e anote so o que faltou.'
          : METODOS[tipo][novo ? 'novo' : 'recuperacao'],
        minutes: BLOCO_MIN,
        place: lugar || '',
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

// Minutos disponiveis num dia. Aceita array (indexado por dia da semana) ou
// funcao (date) -> minutos.
export function orcamentoDe(budget, date) {
  if (typeof budget === 'function') return budget(date) ?? 0;
  const dow = new Date(date + 'T12:00:00').getDay();
  return budget?.[dow] ?? 0;
}

// Quantos blocos de 50min cabem num dia, dado o orcamento por dia da semana.
// Mora aqui e nao no store porque e aritmetica de planejamento, e porque dentro
// do store nao daria teste. O store usa isto pra nao empilhar num dia mais
// bloco do que o dia aguenta.
export function blocosQueCabem(budget, date) {
  return Math.floor(orcamentoDe(budget, date) / BLOCO_MIN);
}

// Titulo curto da tarefa que vai pro app.
export function tituloBloco(b) {
  const alvo = b.alvo ? ` (${b.alvo.name} em ${b.alvo.dias}d)` : '';
  return `${b.code}: ${b.topic || (b.kind === 'novo' ? 'conteudo novo' : 'revisao')}${alvo}`;
}
