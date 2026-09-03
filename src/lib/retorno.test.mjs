// Checagem do retorno. Roda com: node src/lib/retorno.test.mjs
import assert from 'node:assert/strict';
import { retornoPorMateria, resumoDoRetorno } from './retorno.js';

const fechado = (topicId, min) => ({
  category: 'estudos', date: '2026-09-10', effort: String(min),
  done: true, required_pomodoros: 2, pomodoros_done: 2, topic_id: topicId,
});
const naoFechado = (topicId, min) => ({
  category: 'estudos', date: '2026-09-10', effort: String(min),
  done: false, required_pomodoros: 2, pomodoros_done: 0, topic_id: topicId,
});

const materias = () => ([
  { id: 'a', code: 'EA513', name: 'Circuitos',
    topics: [{ id: 'a1' }, { id: 'a2' }],
    exams: [{ name: 'P1', date: '2026-09-17', type: 'prova', grade: 3 }] },
  { id: 'b', code: 'MC404', name: 'Organizacao',
    topics: [{ id: 'b1' }],
    exams: [{ name: 'P1', date: '2026-10-19', type: 'prova', grade: 8 }] },
  { id: 'c', code: 'MC919', name: 'Visao',
    topics: [{ id: 'c1' }],
    exams: [{ name: 'T1', date: '2026-10-05', type: 'atividade', grade: null }] },
]);

// --- so bloco fechado conta hora -------------------------------------------
{
  const tasks = [fechado('a1', 60), fechado('a2', 60), naoFechado('a1', 60)];
  const r = retornoPorMateria(materias(), tasks);
  const ea = r.find(l => l.code === 'EA513');
  assert.equal(ea.minutos, 120, 'bloco nao fechado nao conta como hora investida');
  assert.equal(ea.horas, 2);
  console.log('ok — hora investida e hora fechada');
}

// --- topic_id resolve a materia (o bloco do plano nao tem subject_id) -------
{
  const r = retornoPorMateria(materias(), [fechado('b1', 180)]);
  assert.equal(r.find(l => l.code === 'MC404').minutos, 180,
    'topic_id tem que resolver a materia');
  assert.equal(r.find(l => l.code === 'EA513').minutos, 0);
  console.log('ok — amarra por topico');
}

// --- bloco solto nao entra na conta de ninguem ------------------------------
{
  const solto = { category: 'estudos', date: '2026-09-10', effort: '60',
    done: true, required_pomodoros: 0, pomodoros_done: 0 };
  const r = retornoPorMateria(materias(), [solto]);
  assert.equal(r.reduce((s, l) => s + l.minutos, 0), 0,
    'bloco sem topico nem materia nao pode ser atribuido');
  console.log('ok — bloco solto nao contamina materia');
}

// --- ordena por hora investida ---------------------------------------------
{
  const r = retornoPorMateria(materias(), [fechado('a1', 600), fechado('b1', 120)]);
  assert.equal(r[0].code, 'EA513', 'quem come mais hora vem primeiro');
  assert.equal(r[1].code, 'MC404');
  console.log('ok — ordem por hora');
}

// --- descasamento grosso: muita hora, nota abaixo de 5 ----------------------
{
  const tasks = [fechado('a1', 600), fechado('b1', 60)];
  const r = retornoPorMateria(materias(), tasks);
  const ea = r.find(l => l.code === 'EA513');   // 600min, nota 3
  const mc = r.find(l => l.code === 'MC404');   // 60min, nota 8
  assert.equal(ea.atencao, true, '10h para uma nota 3 tem que acender');
  assert.equal(mc.atencao, false, 'nota 8 nao acende');
  assert.equal(mc.rendendo, true, 'pouca hora e nota boa: nao mexer aqui');
  console.log('ok — flagra o descasamento e tambem o que ja rende');
}

// --- sem nota lancada nao ha retorno pra julgar ----------------------------
{
  const r = retornoPorMateria(materias(), [fechado('c1', 900)]);
  const mv = r.find(l => l.code === 'MC919');
  assert.equal(mv.lancadas, 0);
  assert.equal(mv.atencao, false, 'sem nota lancada e custo, nao retorno ruim');
  assert.equal(mv.mediaSimples, null);
  console.log('ok — sem nota nao acusa nada');
}

// --- a formula da materia vence a media aritmetica -------------------------
{
  const m = materias();
  m[0].exams = [
    { name: 'P1', date: '2026-09-17', type: 'prova', grade: 2 },
    { name: 'P2', date: '2026-12-03', type: 'prova', grade: 8 },
  ];
  m[0].grade_formula = '(P1 * 0.7) + (P2 * 0.3)';   // pesa a P1
  const r = retornoPorMateria(m, []);
  const ea = r.find(l => l.code === 'EA513');
  assert.equal(ea.mediaSimples, 5, 'media aritmetica de 2 e 8 e 5');
  assert.equal(ea.media, 3.8, 'pela formula: 2*0.7 + 8*0.3 = 3.8');
  assert.equal(ea.erroFormula, null);
  console.log('ok — a formula de aprovacao manda, nao a aritmetica');
}

// --- formula quebrada nao derruba a linha ----------------------------------
{
  const m = materias();
  m[0].grade_formula = 'P1 + naoExiste';
  const r = retornoPorMateria(m, []);
  const ea = r.find(l => l.code === 'EA513');
  assert.equal(ea.media, null, 'formula invalida devolve media null');
  assert.ok(ea.erroFormula, 'e diz qual foi o erro');
  assert.equal(ea.mediaSimples, 3, 'e a aritmetica continua servindo');
  console.log('ok — formula quebrada degrada, nao explode');
}

// --- o resumo se cala quando nao tem o que dizer --------------------------
{
  assert.equal(resumoDoRetorno(materias(), []), null,
    'sem hora investida nao ha descasamento');
  const m1 = [materias()[0]];
  assert.equal(resumoDoRetorno(m1, [fechado('a1', 600)]), null,
    'com uma materia com nota nao se compara nada');
  const r = resumoDoRetorno(materias(), [fechado('a1', 600), fechado('b1', 60)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].code, 'EA513');
  assert.equal(r[0].horas, 10);
  console.log('ok — o resumo se cala sem base, e fala com base');
}

console.log('ok — retorno');
