// Checagem da aderencia. Roda com: node src/lib/aderencia.test.mjs
import assert from 'node:assert/strict';
import { aderencia, horariosQueRendem } from './aderencia.js';

const HOJE = '2026-09-30';
const SEM = 8;   // janela larga: os casos espalham blocos de 2 em 2 dias

const dia = (n) => {
  const d = new Date(HOJE + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const bloco = (date, { pom = 0, req = 2, done = false, time = '19:00' } = {}) => ({
  category: 'estudos', date, effort: '60', time,
  done, required_pomodoros: req, pomodoros_done: pom,
});
const fechado = (date, o = {}) => bloco(date, { pom: 2, done: true, ...o });
const comecado = (date, o = {}) => bloco(date, { pom: 1, done: false, ...o });
const intocado = (date, o = {}) => bloco(date, { pom: 0, done: false, ...o });

// n blocos, um a cada 2 dias pra tras: 20 blocos cobrem 40 dias e passam o
// portao de espalhamento. `feitos` diz quantos dos n foram fechados.
const serie = (n, feitos, fabrica = intocado, opts = {}) =>
  Array.from({ length: n }, (_, i) =>
    (i < feitos ? fechado : fabrica)(dia(-2 * (i + 1)), opts));

// --- os dois portoes: volume E tempo ----------------------------------------
{
  const a = aderencia([fechado(dia(-2))], HOJE, SEM);
  assert.equal(a.baseSuficiente, false, '1 bloco nao e base');
  assert.equal(a.veredito, 'indefinido');
  assert.equal(a.modoDeFalha, null, 'sem base nao aponta modo de falha');

  // 20 blocos, mas todos em 3 dias: volume passa, tempo nao. E o caso real
  // medido no banco em 02/09/2026 — 10 blocos do planejador em 3 dias, todos
  // sem pomodoro. Chamar isso de aversao seria ler uma feature recem-nascida.
  const apertado = [];
  for (let k = 0; k < 20; k++) apertado.push(intocado(dia(-1 - (k % 3))));
  const b = aderencia(apertado, HOJE, SEM);
  assert.equal(b.total, 20, 'os 20 entraram na janela');
  assert.equal(b.diasObservados, 3);
  assert.equal(b.baseSuficiente, false, '20 blocos em 3 dias nao e padrao');
  assert.equal(b.veredito, 'indefinido', 'nao pode acusar aversao com 3 dias');

  // 14 blocos espalhados por 28 dias: tempo passa, volume nao.
  const magro = serie(14, 0);
  const c = aderencia(magro, HOJE, SEM);
  assert.ok(c.diasObservados >= 14, 'espalhamento ok');
  assert.equal(c.baseSuficiente, false, 'mas 14 blocos nao chega a 20');
  console.log('ok — precisa de volume E de tempo, nao de um so');
}

// --- veredito "canon": ele fecha o que planeja ------------------------------
{
  const a = aderencia(serie(20, 15), HOJE, SEM);
  assert.equal(a.total, 20);
  assert.equal(a.fechados, 15);
  assert.equal(a.taxa, 0.75);
  assert.equal(a.baseSuficiente, true);
  assert.equal(a.veredito, 'canon', '75% fecha: a regra 3 esta certa, nao mexer');
  console.log('ok — 75% ou mais absolve o bloco de 50min');
}

// --- veredito "aversao": ele nao abre --------------------------------------
{
  const a = aderencia(serie(20, 6), HOJE, SEM);
  assert.equal(a.taxa, 0.3);
  assert.equal(a.veredito, 'aversao', 'abaixo de 50% a aversao esta ganhando');
  assert.equal(a.modoDeFalha, 'nem abriu', '14 intocados contra 0 comecados');
  console.log('ok — abaixo de 50% acusa aversao, e diz que ele nem abriu');
}

// --- zona morta entre 50% e 75% --------------------------------------------
{
  const a = aderencia(serie(20, 12), HOJE, SEM);
  assert.equal(a.taxa, 0.6);
  assert.equal(a.veredito, 'indefinido', '60% nao absolve nem acusa');
  console.log('ok — zona morta nao opina');
}

// --- o modo de falha separa "nem abriu" de "abriu e parou" -----------------
{
  const a = aderencia(serie(20, 5, comecado), HOJE, SEM);
  assert.equal(a.modoDeFalha, 'abriu e parou', 'comecados dominam');
  assert.equal(a.intocados, 0);
  assert.equal(a.comecados, 15);
  assert.equal(a.taxaAparecimento, 1, 'ele apareceu em todos, so nao fechou');
  assert.equal(a.taxa, 0.25, 'mas fechou so 25%');
  console.log('ok — aparecer e fechar sao numeros diferentes, e tem que ser');
}

// --- marcar sem o pomodoro nao e fechar ------------------------------------
{
  const t = serie(20, 0, (d) => bloco(d, { pom: 0, req: 2, done: true }));
  const a = aderencia(t, HOJE, SEM);
  assert.equal(a.fechados, 0, 'done sem pomodoro nao fecha (effectiveDone)');
  assert.equal(a.intocados, 20);
  assert.equal(a.veredito, 'aversao');
  console.log('ok — effectiveDone manda aqui tambem');
}

// --- bloco sem pomodoro exigido fecha no check ------------------------------
{
  const t = serie(20, 0, (d) => bloco(d, { pom: 0, req: 0, done: true }));
  assert.equal(aderencia(t, HOJE, SEM).fechados, 20,
    'sem exigencia de pomodoro, o check basta');
  console.log('ok — bloco sem pomodoro exigido');
}

// --- hoje e futuro ficam fora ----------------------------------------------
{
  const a = aderencia([fechado(HOJE), fechado('2026-10-10')], HOJE, SEM);
  assert.equal(a.total, 0, 'dia em curso e futuro nao sao evidencia');
  console.log('ok — janela fechada');
}

// --- outra categoria nao entra ---------------------------------------------
{
  const casa = Array.from({ length: 20 }, (_, i) => ({
    category: 'casa', date: dia(-2 * (i + 1)), effort: '30', done: false,
  }));
  assert.equal(aderencia(casa, HOJE, SEM).total, 0, 'tarefa de casa nao mede estudo');
  console.log('ok — so categoria estudos');
}

// --- por hora: onde ele aparece e onde ele nao aparece ----------------------
{
  const t = [
    ...serie(6, 6, intocado, { time: '09:00' }),
    ...Array.from({ length: 6 }, (_, i) => intocado(dia(-13 - 2 * i), { time: '22:00' })),
  ];
  const a = aderencia(t, HOJE, SEM);
  assert.equal(a.porHora.find(h => h.hora === '09').taxa, 1, '9h fecha tudo');
  assert.equal(a.porHora.find(h => h.hora === '22').taxa, 0, '22h nao fecha nada');
  const r = horariosQueRendem(t, HOJE, SEM);
  assert.equal(r.melhor.hora, '09');
  assert.equal(r.pior.hora, '22');
  console.log('ok — separa o horario que rende do que nao rende');
}

// --- por dia da semana ------------------------------------------------------
{
  // 2026-09-28, 21 e 14 sao segundas; 26, 19 e 12 sao sabados
  const t = [
    fechado('2026-09-28'), fechado('2026-09-21'), fechado('2026-09-14'),
    intocado('2026-09-26'), intocado('2026-09-19'), intocado('2026-09-12'),
  ];
  const a = aderencia(t, HOJE, SEM);
  assert.equal(a.porDow[1].taxa, 1, 'segunda fecha');
  assert.equal(a.porDow[6].taxa, 0, 'sabado nao fecha');
  console.log('ok — separa por dia da semana');
}

console.log('ok — aderencia');
