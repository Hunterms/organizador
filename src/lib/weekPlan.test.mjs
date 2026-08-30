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

// --- regra 4: nunca duas vezes a mesma materia no mesmo dia ------------------
for (const dia of Object.keys(porDia)) {
  const codes = plano.filter(b => b.date === dia).map(b => b.code);
  assert.equal(new Set(codes).size, codes.length, `${dia} repetiu materia no mesmo dia`);
}

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
    { id: 'velho', name: 'ja visto', status: 'not_studied', last_studied: '2026-08-29' },
    { id: 'novo', name: 'nunca visto', status: 'not_studied' },
  ],
  exams: [{ name: 'P1', date: '2026-10-06', status: 'pendente' }],
}];
const p2 = buildWeekPlan(comHistorico, DOM);
assert.equal(p2[0].topicId, 'novo', 'topico nunca estudado tem que vir antes do ja estudado');

console.log('ok — topico amarrado e ordem por esquecimento');
