// Checagem do planejador. Roda com: node src/lib/weekPlan.test.mjs
import assert from 'node:assert/strict';
import { buildWeekPlan, urgencia, tipoDe, BLOCO_MIN } from './weekPlan.js';

const t = (id, name, status = 'not_studied') => ({ id, name, status });
const S = [
  { id: '1', code: 'EE400', class_schedule: [{ day: 1, time: '08:00', duration: 120 }, { day: 3, time: '08:00', duration: 120 }],
    topics: [t('e1', 'Geometria analitica'), t('e2', 'Calculo vetorial'), t('e3', 'Numeros complexos')],
    exams: [{ name: 'Prova 1', date: '2026-09-09', status: 'pendente' }] },
  { id: '2', code: 'MC426', class_schedule: [{ day: 2, time: '08:00', duration: 120 }, { day: 4, time: '08:00', duration: 120 }],
    topics: [t('m1', 'Processos de software'), t('m2', 'Requisitos')],
    exams: [{ name: 'A1', date: '2026-09-01', status: 'pendente' }] },
  { id: '3', code: 'MC404', class_schedule: [{ day: 1, time: '14:00', duration: 120 }, { day: 3, time: '16:00', duration: 120 }],
    topics: [t('c1', 'Assembly RISC-V'), t('c2', 'Pilha e procedimentos')],
    exams: [{ name: 'Prova 1', date: '2026-10-19', status: 'pendente' }] },
  { id: '4', code: 'MC621', class_schedule: [{ day: 5, time: '14:00', duration: 240 }],
    topics: [t('p1', 'Exponenciacao rapida')], exams: [] },
  { id: '5', code: 'MS211', class_schedule: [{ day: 2, time: '19:00', duration: 120 }, { day: 4, time: '21:00', duration: 120 }],
    topics: [t('n1', 'Zeros de funcoes'), t('n2', 'Sistemas lineares')],
    exams: [{ name: 'Prova 1', date: '2026-10-06', status: 'pendente' }] },
  { id: '6', code: 'MC919', class_schedule: [{ day: 1, time: '21:00', duration: 120 }, { day: 3, time: '19:00', duration: 120 }],
    topics: [t('v1', 'Filtragem'), t('v2', 'Deteccao de bordas')],
    exams: [{ name: 'Trabalho 1', date: '2026-10-05', status: 'pendente' }] },
];

const DOM = '2026-08-30';
// Enche os topicos: com poucos topicos o teto por materia corta o plano antes
// do orcamento, e ai o teste de orcamento nao mede orcamento. O caso de poucos
// topicos tem teste proprio la embaixo.
for (const sub of S) while (sub.topics.length < 5) sub.topics.push(t(sub.id + 'x' + sub.topics.length, 'extra ' + sub.topics.length));
const plano = buildWeekPlan(S, DOM);

// --- orcamento: 2h por dia util, 4h no fim de semana, blocos de 50min --------
assert.equal(BLOCO_MIN, 50);
assert.equal(plano.length, 18, '5 dias uteis x2 + 2 dias de fds x4 = 18 blocos');
const porDia = {};
for (const b of plano) porDia[b.date] = (porDia[b.date] || 0) + 1;
assert.equal(porDia['2026-08-30'], 4, 'domingo: 4 blocos');
assert.equal(porDia['2026-08-31'], 2, 'segunda: 2 blocos');
assert.equal(porDia['2026-09-05'], 4, 'sabado: 4 blocos');
assert.equal(Object.keys(porDia).length, 7, 'cobre os 7 dias');

// --- regra 1: prazo manda ----------------------------------------------------
// MC426 tem A1 em 2 dias; MC621 nao tem prova nenhuma.
assert.ok(urgencia(S[1], DOM).peso > urgencia(S[3], DOM).peso * 5,
  'prova em 2 dias pesa muito mais que materia sem prova');
const conta = c => plano.filter(b => b.code === c).length;
assert.ok(conta('MC426') >= conta('MC621'), 'MC426 (prova em 2d) nao pode receber menos que MC621');

// --- regra 2: ninguem zera ---------------------------------------------------
for (const s of S) {
  assert.ok(conta(s.code) >= 1, `${s.code} ficou sem nenhum bloco na semana`);
}

// --- regra 4: uma materia por dia, EXCETO com avaliacao a menos de 2 dias ----
const crunchDoDia = (dia) => S.filter(sub => (sub.exams || []).some(e => {
  const d = Math.round((new Date(e.date + 'T12:00:00') - new Date(dia + 'T12:00:00')) / 86400000);
  return d >= 0 && d <= 1;
})).map(sub => sub.code);
for (const dia of Object.keys(porDia)) {
  const codes = plano.filter(b => b.date === dia).map(b => b.code);
  const semCrunch = codes.filter(c => !crunchDoDia(dia).includes(c));
  assert.equal(new Set(semCrunch).size, semCrunch.length,
    `${dia} repetiu materia sem prazo colado: ${codes}`);
}
// E o inverso tem que valer: no dia anterior a A1, MC426 toma o dia inteiro.
const vespera = plano.filter(b => b.date === '2026-08-31').map(b => b.code);
assert.ok(vespera.every(c => c === 'MC426'),
  `vespera da A1 devia ser toda de MC426, veio ${vespera}`);

// --- regra 5: conteudo novo so no fim de semana ------------------------------
for (const b of plano) {
  const dow = new Date(b.date + 'T12:00:00').getDay();
  const fds = dow === 0 || dow === 6;
  assert.equal(b.kind, fds ? 'novo' : 'recuperacao', `${b.date} recebeu o tipo errado de bloco`);
}

// --- metodo bate com o tipo da materia --------------------------------------
assert.equal(tipoDe(S[2]), 'programacao');
assert.ok(plano.filter(b => b.code === 'MC404').every(b => /PRIMM|Parsons/.test(b.method)),
  'MC404 tem que receber metodo de programacao');
assert.ok(plano.filter(b => b.code === 'EE400').every(b => /Worked example|Practice testing/.test(b.method)),
  'EE400 tem que receber metodo de matematica');
assert.ok(plano.filter(b => b.code === 'MC919').every(b => /Marco|marco/.test(b.method)),
  'MC919 tem que receber metodo de projeto');

// --- horario nao pode colidir com aula --------------------------------------
for (const b of plano) {
  if (!b.time) continue;
  const dow = new Date(b.date + 'T12:00:00').getDay();
  const ini = Number(b.time.slice(0, 2)) * 60;
  for (const s of S) {
    for (const sl of s.class_schedule) {
      if (sl.day !== dow) continue;
      const a = Number(sl.time.slice(0, 2)) * 60, z = a + sl.duration;
      assert.ok(!(ini < z && ini + BLOCO_MIN > a),
        `bloco ${b.date} ${b.time} cai em cima da aula de ${s.code}`);
    }
  }
}

// --- dois blocos no mesmo dia nao podem ter o mesmo horario -----------------
for (const dia of Object.keys(porDia)) {
  const horas = plano.filter(b => b.date === dia && b.time).map(b => b.time);
  assert.equal(new Set(horas).size, horas.length, `${dia} marcou dois blocos na mesma hora`);
}

// --- sem materia nenhuma, plano vazio em vez de crash -----------------------
assert.deepEqual(buildWeekPlan([], DOM), []);
assert.deepEqual(buildWeekPlan(S, DOM, [0, 0, 0, 0, 0, 0, 0]), [], 'orcamento zero, plano zero');

console.log('ok — plano da semana:', plano.length, 'blocos');

// --- alvo nao pode apontar pra avaliacao que ja passou -----------------------
for (const b of plano) {
  if (!b.alvo) continue;
  assert.ok(b.alvo.date >= b.date,
    `${b.date} ${b.code} aponta pra ${b.alvo.name} de ${b.alvo.date}, que ja passou`);
  assert.ok(b.alvo.dias >= 0, 'dias ate o alvo nao pode ser negativo');
}

// --- ordem do relogio dentro do dia -----------------------------------------
for (let i = 1; i < plano.length; i++) {
  const a = plano[i - 1], b = plano[i];
  if (a.date !== b.date) continue;
  assert.ok((a.time || '99') <= (b.time || '99'), `${b.date} fora de ordem: ${a.time} antes de ${b.time}`);
}
console.log('ok — alvo por data do bloco e ordem do relogio');

// --- o topico vai amarrado, nao so no titulo --------------------------------
for (const b of plano) {
  if (!b.topic) continue;
  assert.ok(b.topicId, `${b.date} ${b.code} tem topico "${b.topic}" sem topicId amarrado`);
}

// --- o mais esquecido primeiro ----------------------------------------------
// t1 estudado ontem, t2 nunca. O plano tem que puxar t2 antes de t1.
const comHistorico = [{
  id: 'x', code: 'MS211', class_schedule: [{ day: 2, time: '19:00', duration: 120 }],
  topics: [
    // `lastStudied` (camel) e a forma que fetchAllData produz no estado. Este
    // teste usava `last_studied` e passava, porque o weekPlan lia a mesma
    // grafia errada: a ordem por esquecimento nunca valeu com dado real.
    { id: 'velho', name: 'ja visto', status: 'not_studied', lastStudied: '2026-08-29' },
    { id: 'novo', name: 'nunca visto', status: 'not_studied' },
  ],
  exams: [{ name: 'P1', date: '2026-10-06', status: 'pendente' }],
}];
const p2 = buildWeekPlan(comHistorico, DOM);
assert.equal(p2[0].topicId, 'novo', 'topico nunca estudado tem que vir antes do ja estudado');

console.log('ok — topico amarrado e ordem por esquecimento');

// --- hora ancora: habito precisa do mesmo contexto (Lally, Wood & Neal) ------
const horasUteis = plano
  .filter(b => { const d = new Date(b.date + 'T12:00:00').getDay(); return d >= 1 && d <= 5; })
  .map(b => b.time).filter(Boolean);
const contagem = {};
for (const h of horasUteis) contagem[h] = (contagem[h] || 0) + 1;
const maisComum = Math.max(...Object.values(contagem));
assert.ok(maisComum >= 4,
  `a ancora tem que repetir em pelo menos 4 blocos de dia util, repetiu ${maisComum}: ${JSON.stringify(contagem)}`);
assert.ok(Object.keys(contagem).length <= 3,
  `dia util nao pode espalhar por mais de 3 horarios diferentes, espalhou ${Object.keys(contagem).length}`);
console.log('ok — hora ancora, mais comum aparece', maisComum, 'vezes em', Object.keys(contagem).length, 'horarios');

// --- nenhum bloco pode sair sem topico quando a materia tem topicos ---------
const poucos = [
  { id: 'p', code: 'MC426', class_schedule: [{ day: 2, time: '08:00', duration: 120 }],
    topics: [t('u0', 'U0'), t('u1', 'U1')],
    exams: [{ name: 'A1', date: '2026-09-01', status: 'pendente' }] },
  { id: 'q', code: 'MS211', class_schedule: [],
    topics: [t('n1', 'Zeros'), t('n2', 'Sistemas'), t('n3', 'Interpolacao'), t('n4', 'Integracao')],
    exams: [{ name: 'P1', date: '2026-10-06', status: 'pendente' }] },
];
const pp = buildWeekPlan(poucos, DOM);
for (const b of pp) {
  assert.ok(b.topic, `${b.date} ${b.code} saiu sem topico — bloco vago nao ensina`);
}
assert.ok(pp.filter(b => b.code === 'MC426').length <= 2,
  'MC426 tem 2 topicos: nao pode receber mais que 2 blocos');
console.log('ok — cota limitada pelos topicos, nenhum bloco vago');

// --- a ordem do relogio tem que seguir a ordem do conteudo ------------------
// Na vespera da A1, MC426 toma o dia inteiro. Os topicos vem em ordem (U0, U1,
// ...), entao os horarios tem que subir junto: estudar U4 antes de U0 e erro.
const vesp = plano.filter(b => b.date === '2026-08-31');
const idxTopico = vesp.map(b => S.find(s => s.code === b.code).topics.findIndex(t => t.name === b.topic));
for (let i = 1; i < vesp.length; i++) {
  assert.ok(vesp[i].time > vesp[i - 1].time, 'horarios do dia tem que subir');
  assert.ok(idxTopico[i] > idxTopico[i - 1],
    `conteudo fora de ordem: ${vesp[i-1].topic} as ${vesp[i-1].time} antes de ${vesp[i].topic} as ${vesp[i].time}`);
}
// E todo bloco tem que ter horario: bloco sem hora nao e implementation intention.
for (const b of plano) assert.ok(b.time, `${b.date} ${b.code} saiu sem horario`);
console.log('ok — relogio segue o conteudo, nenhum bloco sem hora');

// --- a prova manda no assunto, nao so na urgencia ---------------------------
// P1 cobre positions 10-19. Nenhum bloco antes dela pode cair na Parte III.
const comFaixa = [{
  id: 'ee', code: 'EE400', class_schedule: [],
  topics: [
    { id: 'p11', name: '1.1', status: 'not_studied', position: 11 },
    { id: 'p12', name: '1.2', status: 'not_studied', position: 12 },
    { id: 'p31', name: '3.1', status: 'not_studied', position: 31 },
    { id: 'p32', name: '3.2', status: 'not_studied', position: 32 },
  ],
  exams: [{ name: 'Prova 1', date: '2026-09-09', status: 'pendente', covers_from: 10, covers_to: 19 },
          { name: 'Prova 3', date: '2026-12-02', status: 'pendente', covers_from: 30, covers_to: 39 }],
}];
const pf = buildWeekPlan(comFaixa, '2026-08-31');
const fora = pf.filter(b => b.topicId && !['p11', 'p12'].includes(b.topicId));
assert.equal(fora.length, 0,
  `bloco fora da faixa da P1: ${fora.map(b => b.topic + ' em ' + b.date)}`);
assert.ok(pf.length >= 2, 'a faixa nao pode zerar o plano');
console.log('ok — topico dentro da faixa da proxima prova');

// --- o peso e taxa exigida, nao proximidade ---------------------------------
const comTopicos = (n, dias, from, to) => ({
  id: 'x' + n, code: 'X', topics: Array.from({ length: n }, (_, i) =>
    ({ id: 'k' + i, name: 'k' + i, status: 'not_studied', position: from + i })),
  exams: [{ name: 'P', date: new Date(Date.UTC(2026, 7, 31) + dias * 86400000).toISOString().slice(0, 10),
            status: 'pendente', covers_from: from, covers_to: to }],
});
// 6 topicos em 9 dias e 12 em 18 sao a MESMA taxa: pesos tem que ficar juntos.
const a = urgencia(comTopicos(6, 9, 10, 19), '2026-08-31').peso;
const b = urgencia(comTopicos(12, 18, 1, 30), '2026-08-31').peso;
assert.ok(Math.abs(a - b) / a < 0.1, `mesma taxa devia dar peso parecido: ${a} vs ${b}`);
// Dobrar o conteudo com o mesmo prazo tem que dobrar o peso.
const c = urgencia(comTopicos(12, 9, 10, 30), '2026-08-31').peso;
assert.ok(c > a * 1.8, `o dobro de conteudo no mesmo prazo devia pesar ~2x: ${a} -> ${c}`);
// Materia sem topico pendente entra em manutencao, nao some do plano.
const d = urgencia({ topics: [{ id: 'm', status: 'mastered', position: 1 }],
  exams: [{ name: 'P', date: '2026-10-01', status: 'pendente' }] }, '2026-08-31');
assert.ok(d.peso > 0 && d.restantes === 0, 'materia coberta continua com peso de manutencao');
console.log('ok — peso por taxa exigida');

// --- intervalo de Cepeda: 10 a 20% do tempo ate a prova ---------------------
const { intervaloCepeda } = await import('./weekPlan.js');
const gap = (h, p) => Math.round((new Date(intervaloCepeda(h, p)) - new Date(h)) / 86400000);
assert.equal(gap('2026-08-31', '2026-09-07'), 1, 'prova em 7 dias: revisa em 1');
assert.equal(gap('2026-08-31', '2026-09-30'), 5, 'prova em 30 dias: revisa em ~5');
assert.equal(gap('2026-08-31', '2026-11-29'), 14, 'prova em 90 dias: revisa em ~14');
assert.equal(intervaloCepeda('2026-08-31', '2026-08-30'), null, 'prova que ja passou nao agenda');
assert.equal(intervaloCepeda('2026-08-31', null), null);
// teto de 21 dias: esquecer antes de revisar nao ajuda
assert.ok(gap('2026-08-31', '2027-08-31') <= 21, 'o intervalo tem teto');

// --- revisao vencida vem antes de conteudo novo -----------------------------
const comRevisao = [{
  id: 'r', code: 'MS211', class_schedule: [],
  topics: [
    { id: 'novo1', name: 'nunca visto', status: 'not_studied', position: 1 },
    { id: 'vence', name: 'revisar', status: 'mastered', position: 2, next_review_at: '2026-08-25' },
  ],
  exams: [{ name: 'P1', date: '2026-10-06', status: 'pendente' }],
}];
const pr = buildWeekPlan(comRevisao, '2026-08-31');
assert.equal(pr[0].topicId, 'vence', 'revisao vencida tem que vir antes de conteudo novo');
assert.equal(pr[0].kind, 'revisao', 'e o bloco tem que ser marcado como revisao');
assert.ok(/Retrieval/.test(pr[0].method), 'com metodo de retrieval, nao de exposicao');
console.log('ok — Cepeda e revisao vencida no topo');

// --- todo bloco tem lugar quando o lugar esta configurado -------------------
const comLugar = buildWeekPlan(S, DOM, undefined, {}, [], 'escritorio');
for (const b of comLugar) {
  assert.equal(b.place, 'escritorio', `${b.date} ${b.code} saiu sem lugar`);
}
// Sem configurar, o campo vem vazio em vez de undefined (evita "undefined" na tela).
assert.ok(buildWeekPlan(S, DOM).every(b => b.place === ''), 'sem lugar configurado o campo vem vazio');
console.log('ok — lugar em todo bloco');

// --- compromisso fixo bloqueia horario sem receber bloco --------------------
// Entra como "materia" sem topico e sem prova: ocupacaoDoDia le o horario dela,
// mas a distribuicao so considera quem tem topico ou prova.
const terreiro = { id: '__ocupado', code: '', topics: [], exams: [],
  class_schedule: [{ day: 6, time: '16:00', duration: 420 }] };
const comTerreiro = buildWeekPlan([...S, terreiro], DOM);
const sabado = comTerreiro.filter(b => b.date === '2026-09-05');
assert.ok(sabado.length > 0, 'o sabado nao pode ficar vazio');
for (const b of sabado) {
  const h = Number(b.time.slice(0, 2));
  assert.ok(h < 16 || h >= 23, `bloco de sabado as ${b.time} cai dentro do terreiro`);
}
assert.ok(!comTerreiro.some(b => b.subjectId === '__ocupado'),
  'compromisso fixo nao pode receber bloco de estudo');
assert.equal(comTerreiro.length, plano.length, 'bloquear o sabado nao pode perder bloco');
console.log('ok — compromisso fixo bloqueia sem consumir');

// --- folga antes de um compromisso fixo -------------------------------------
const sab = comTerreiro.filter(b => b.date === '2026-09-05').map(b => b.time).sort();
const ultimoFim = Number(sab[sab.length - 1].slice(0, 2)) * 60 + 50;
assert.ok(16 * 60 - ultimoFim >= 60,
  `so ${16 * 60 - ultimoFim} min entre o ultimo bloco (${sab[sab.length - 1]}) e o terreiro`);
console.log('ok — folga de', 16 * 60 - ultimoFim, 'min antes do compromisso');

// --- teto de blocos por dia --------------------------------------------------
// store.js usa isto pra nao empilhar num dia mais bloco do que o dia aguenta.
// Medido em 02/09/2026: sem teto, o replanejamento diario criava 515 blocos
// contra um orcamento de 216, e uma terca de 2 blocos recebia 7.
{
  const { blocosQueCabem } = await import('./weekPlan.js');
  const orc = [240, 120, 120, 120, 120, 120, 240];
  assert.equal(blocosQueCabem(orc, '2026-09-06'), 4, 'domingo: 240/50 = 4 blocos');
  assert.equal(blocosQueCabem(orc, '2026-09-07'), 2, 'segunda: 120/50 = 2 blocos');
  assert.equal(blocosQueCabem(orc, '2026-09-12'), 4, 'sabado: 4 blocos');
  assert.equal(blocosQueCabem([], '2026-09-07'), 0, 'sem orcamento, nada cabe');
  assert.equal(blocosQueCabem(undefined, '2026-09-07'), 0, 'orcamento ausente nao explode');
  console.log('ok — teto de blocos por dia');
}

// --- cobertura responde ao trabalho feito ------------------------------------
// Antes, `restantes` era `status !== 'mastered'`, e concluir um bloco nao toca
// status: MS211 chegava a 7 de 7 topicos estudados com o planejador ainda vendo
// 7 restantes, e o peso da materia saia de um numero que nunca se movia.
{
  const base = () => ({
    id: 'x', code: 'MS211', topics: [
      { id: 'a', name: 'a', status: 'not_studied', position: 1 },
      { id: 'b', name: 'b', status: 'not_studied', position: 2 },
      { id: 'c', name: 'c', status: 'not_studied', position: 3 },
    ],
    exams: [{ name: 'Prova 1', date: '2026-10-06', status: 'pendente' }],
  });
  const hoje = '2026-09-06';
  assert.equal(urgencia(base(), hoje).restantes, 3, 'nada estudado: 3 pendentes');

  const estudado = base();
  estudado.topics[0].lastStudied = hoje;
  estudado.topics[0].next_review_at = '2026-09-11'; // revisao no futuro
  assert.equal(urgencia(estudado, hoje).restantes, 2,
    'topico estudado com revisao no futuro sai da conta');

  const vencido = base();
  vencido.topics[0].lastStudied = '2026-08-20';
  vencido.topics[0].next_review_at = '2026-09-01'; // revisao VENCIDA
  assert.equal(urgencia(vencido, hoje).restantes, 3,
    'revisao vencida volta a contar como pendente');

  const semRevisao = base();
  semRevisao.topics[0].lastStudied = hoje; // estudado, sem data de revisao
  assert.equal(urgencia(semRevisao, hoje).restantes, 3,
    'estudado sem revisao agendada continua pendente');
  console.log('ok — cobertura responde ao trabalho, e a vencida volta');
}

// --- revisao vencida garante bloco, nao so lugar na fila --------------------
// escolheTopico ja punha a vencida na frente, mas so entre os blocos que a
// materia recebeu. Materia com cota zero nunca revisava.
{
  const semProva = {
    id: 'z', code: 'MC621', class_schedule: [],
    topics: [{ id: 'z1', name: 'z1', status: 'not_studied', position: 1,
               lastStudied: '2026-08-25', next_review_at: '2026-09-01' }],
    exams: [],
  };
  const outras = S.map(s => ({ ...s }));
  const recente = {};
  for (const s of [...outras, semProva]) recente[s.id] = '2026-09-05'; // ninguem "esquecido"
  const p = buildWeekPlan([...outras, semProva], '2026-09-06', undefined, recente);
  assert.ok(p.filter(b => b.subjectId === 'z').length >= 1,
    'materia sem prova mas com revisao vencida tem que receber bloco');
  console.log('ok — revisao vencida garante cota');
}

// --- rampa de carga: orcamento por DATA, nao so por dia da semana ------------
// Pedido em 03/09/2026: "aumenta bastante a carga nos proximos dias pra eu ter
// uma rotina mais de boa depois". Uma semana que atravessa o fim do boost tem
// dias com orcamento diferente, e array indexado por dia da semana nao expressa
// isso — dai buildWeekPlan e blocosQueCabem aceitarem funcao.
{
  const { orcamentoDe, blocosQueCabem: cabem } = await import('./weekPlan.js');
  const normal = [240, 120, 120, 120, 120, 120, 240];
  const boost  = [300, 180, 180, 180, 180, 180, 300];
  const ATE = '2026-09-17';
  const rampa = (date) => {
    const dow = new Date(date + 'T12:00:00').getDay();
    return (date <= ATE ? boost : normal)[dow];
  };

  // array continua funcionando
  assert.equal(orcamentoDe(normal, '2026-09-07'), 120, 'segunda no array');
  assert.equal(orcamentoDe(normal, '2026-09-12'), 240, 'sabado no array');
  assert.equal(orcamentoDe(undefined, '2026-09-07'), 0, 'sem orcamento nao explode');

  // funcao decide pela data
  assert.equal(orcamentoDe(rampa, '2026-09-07'), 180, 'segunda dentro do boost');
  assert.equal(orcamentoDe(rampa, '2026-09-21'), 120, 'segunda depois do boost');
  assert.equal(orcamentoDe(rampa, ATE), 180, 'o ultimo dia do boost ainda e boost');
  assert.equal(orcamentoDe(rampa, '2026-09-18'), 120, 'o dia seguinte ja e normal');

  assert.equal(cabem(rampa, '2026-09-07'), 3, '180/50 = 3 blocos');
  assert.equal(cabem(rampa, '2026-09-21'), 2, '120/50 = 2 blocos');

  // e o plano usa isso: a semana do boost tem que ter mais bloco que a normal
  const semanaBoost = buildWeekPlan(S, '2026-09-06', rampa);
  const semanaNormal = buildWeekPlan(S, '2026-09-20', rampa);
  assert.ok(semanaBoost.length > semanaNormal.length,
    `boost ${semanaBoost.length} tem que ser > normal ${semanaNormal.length}`);
  console.log('ok — rampa de carga:', semanaBoost.length, 'blocos no boost contra', semanaNormal.length, 'depois');
}

// --- nenhum bloco sem horario, inclusive com a rampa ------------------------
// O teste antigo ("relogio segue o conteudo") usava o orcamento normal, que
// cabe folgado. Com boost de 6 blocos no sabado e o terreiro das 16h as 23h,
// sobravam 5 candidatos e um bloco nascia SEM hora — e bloco sem hora nao vira
// implementation intention (Gollwitzer pede gatilho, hora E lugar).
{
  const BOOST = [300, 180, 180, 180, 180, 180, 300];
  const comTerreiroSab = { id: '__ocupado', code: '', topics: [], exams: [],
    class_schedule: [{ day: 6, time: '16:00', duration: 420 }] };
  const p = buildWeekPlan([...S, comTerreiroSab], '2026-09-06', BOOST, {}, [1, 2, 3, 4, 5], 'escritorio');
  const semHora = p.filter(b => !b.time);
  assert.equal(semHora.length, 0,
    `${semHora.length} bloco(s) sem horario: ${semHora.map(b => b.date + ' ' + b.code).join(', ')}`);
  // e nenhum pode cair dentro do terreiro
  for (const b of p.filter(b => new Date(b.date + 'T12:00:00').getDay() === 6)) {
    const h = Number(b.time.slice(0, 2));
    assert.ok(h < 16, `bloco de sabado as ${b.time} invade o terreiro`);
  }
  console.log('ok — com boost, todos os', p.length, 'blocos tem hora e o sabado respeita o terreiro');
}

// --- precedencia se divide por tipo de dia ----------------------------------
// Medido em 03/09/2026: com a prova em 13 dias o intervalo do Cepeda da 2 dias,
// entao revisao vencia a cada 2 dias e comia a capacidade. A EA513 recebia 14
// blocos e cobria 7 dos 12 topicos da prova, re-revisando os mesmos 7 — cinco
// chegariam na prova sem nenhuma exposicao. Nao se revisa o que nao se aprendeu.
{
  const t = (id, pos, extra = {}) => ({ id, name: id, position: pos, status: 'not_studied', ...extra });
  const materia = (topics) => [{
    id: 'x', code: 'EA513', class_schedule: [], topics,
    exams: [{ name: 'P1', date: '2026-09-17', status: 'pendente', covers_from: 1, covers_to: 12 }],
  }];

  // t1 ja estudado e com revisao VENCIDA; t2 nunca visto.
  const topics = [
    t('visto', 1, { lastStudied: '2026-09-04', next_review_at: '2026-09-05' }),
    t('nunca', 2),
  ];

  // Dia de conteudo novo (sabado 05/09): o nunca visto tem que vir primeiro.
  const fds = buildWeekPlan(materia(topics), '2026-09-05', [120, 0, 0, 0, 0, 0, 0]);
  assert.equal(fds[0].topicId, 'nunca', 'no fim de semana, cobertura vem antes de revisao');

  // Dia de recuperacao (segunda 07/09): a revisao vencida tem que vir primeiro.
  const util = buildWeekPlan(materia(topics), '2026-09-06', [0, 120, 0, 0, 0, 0, 0]);
  assert.equal(util[0].topicId, 'visto', 'em dia util, revisao vencida vem antes');
  assert.equal(util[0].kind, 'revisao', 'e ela troca o metodo pra retrieval');

  // Sem nada nunca visto, o fim de semana volta a puxar a revisao vencida.
  const soVisto = [t('visto', 1, { lastStudied: '2026-09-04', next_review_at: '2026-09-05' })];
  const fds2 = buildWeekPlan(materia(soVisto), '2026-09-05', [120, 0, 0, 0, 0, 0, 0]);
  assert.equal(fds2[0].topicId, 'visto', 'coberto tudo, a revisao volta a mandar');
  console.log('ok — cobertura manda na manha e no fds, retrieval manda no dia util');
}
