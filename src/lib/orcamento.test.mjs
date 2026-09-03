// Checagem do orcamento medido. Roda com: node src/lib/orcamento.test.mjs
import assert from 'node:assert/strict';
import { orcamentoMedido, desvioDoDeclarado, BLOCO_MIN } from './orcamento.js';

const DECLARADO = [240, 120, 120, 120, 120, 120, 240]; // dom..sab
const HOJE = '2026-09-30';

// bloco de estudo concluido, com o pomodoro cumprido
const feito = (date, min) => ({
  category: 'estudos', date, effort: String(min), done: true,
  required_pomodoros: 2, pomodoros_done: 2,
});
// bloco criado e nao fechado
const naoFeito = (date, min) => ({
  category: 'estudos', date, effort: String(min), done: false,
  required_pomodoros: 2, pomodoros_done: 0,
});
// marcado como feito SEM o pomodoro: effectiveDone recusa, e tem que recusar
const mentira = (date, min) => ({
  category: 'estudos', date, effort: String(min), done: true,
  required_pomodoros: 2, pomodoros_done: 0,
});

// --- sem historico: respeita o que foi declarado ----------------------------
assert.deepEqual(orcamentoMedido([], HOJE, DECLARADO), DECLARADO,
  'sem dado nenhum, nao mexe no declarado');

// --- uma observacao so nao e base -------------------------------------------
assert.deepEqual(orcamentoMedido([feito('2026-09-28', 50)], HOJE, DECLARADO), DECLARADO,
  'uma segunda medida nao autoriza mudar a segunda');

// --- duas observacoes: passa a valer a mediana -------------------------------
{
  // segundas de setembro: 07, 14, 21, 28
  const tasks = [
    feito('2026-09-07', 50), naoFeito('2026-09-07', 50),   // fez 50 de 100
    feito('2026-09-14', 50), naoFeito('2026-09-14', 50),   // fez 50
    feito('2026-09-21', 50), feito('2026-09-21', 50),      // fez 100
  ];
  const o = orcamentoMedido(tasks, HOJE, DECLARADO);
  assert.equal(o[1], 50, 'mediana de 50, 50, 100 = 50');
  assert.equal(o[2], 120, 'terca sem base fica no declarado');
  console.log('ok — mediana do que foi fechado vira o orcamento');
}

// --- teto no declarado -------------------------------------------------------
{
  const tasks = [
    feito('2026-09-07', 120), feito('2026-09-07', 120),
    feito('2026-09-14', 120), feito('2026-09-14', 120),
  ];
  const o = orcamentoMedido(tasks, HOJE, DECLARADO);
  assert.equal(o[1], 120, 'render 240 numa segunda nao autoriza 240: a CLT e a aula existem');
  console.log('ok — teto no declarado');
}

// --- piso de um bloco: semana ruim nao apaga o plano ------------------------
{
  const tasks = [
    naoFeito('2026-09-07', 50), naoFeito('2026-09-07', 50),
    naoFeito('2026-09-14', 50), naoFeito('2026-09-14', 50),
    naoFeito('2026-09-21', 50), naoFeito('2026-09-21', 50),
  ];
  const o = orcamentoMedido(tasks, HOJE, DECLARADO);
  assert.equal(o[1], BLOCO_MIN, 'zero fechado vira piso de 1 bloco, nao zero');
  assert.ok(o[1] > 0, 'orcamento zero apagaria o dia inteiro do plano');
  console.log('ok — piso de um bloco');
}

// --- marcar sem pomodoro nao conta ------------------------------------------
{
  const tasks = [
    mentira('2026-09-07', 50), mentira('2026-09-07', 50),
    mentira('2026-09-14', 50), mentira('2026-09-14', 50),
  ];
  const o = orcamentoMedido(tasks, HOJE, DECLARADO);
  assert.equal(o[1], BLOCO_MIN, 'done sem pomodoro nao e trabalho feito (effectiveDone)');
  console.log('ok — effectiveDone manda, done sozinho nao');
}

// --- hoje e o futuro ficam fora ---------------------------------------------
{
  const tasks = [
    feito(HOJE, 120), feito(HOJE, 120),
    feito('2026-10-05', 120), feito('2026-10-05', 120),
  ];
  assert.deepEqual(orcamentoMedido(tasks, HOJE, DECLARADO), DECLARADO,
    'dia em curso e dia futuro nao sao evidencia');
  console.log('ok — janela fechada, sem hoje e sem futuro');
}

// --- fora da janela de 4 semanas --------------------------------------------
{
  const tasks = [feito('2026-07-06', 50), feito('2026-07-13', 50)]; // ~12 semanas atras
  assert.deepEqual(orcamentoMedido(tasks, HOJE, DECLARADO), DECLARADO,
    'julho nao decide setembro');
  console.log('ok — janela de 4 semanas');
}

// --- tarefa de outra categoria nao entra ------------------------------------
{
  const casa = [
    { category: 'casa', date: '2026-09-07', effort: '30', done: true },
    { category: 'casa', date: '2026-09-14', effort: '30', done: true },
  ];
  assert.deepEqual(orcamentoMedido(casa, HOJE, DECLARADO), DECLARADO,
    'limpar a sala nao e orcamento de estudo');
  console.log('ok — so categoria estudos');
}

// --- o desvio e legivel pra mostrar na tela ---------------------------------
{
  const tasks = [
    feito('2026-09-07', 50), naoFeito('2026-09-07', 50),
    feito('2026-09-14', 50), naoFeito('2026-09-14', 50),
  ];
  const d = desvioDoDeclarado(tasks, HOJE, DECLARADO);
  assert.equal(d.length, 1, 'so a segunda tem base');
  assert.deepEqual(d[0], { dow: 1, declarado: 120, medido: 50, delta: -70 });
  console.log('ok — desvio legivel, pra corrigir na cara e nao em silencio');
}

console.log('ok — orcamento medido');
