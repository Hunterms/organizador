// Roda com: node src/lib/rotina.test.mjs
import assert from 'node:assert/strict';
import { caiHoje, indiceDaSemana, EPOCH_SEGUNDA } from './rotina.js';

const SEG = '2026-08-31', TER = '2026-09-01', SEG2 = '2026-09-07', SEG3 = '2026-09-14', SEG5 = '2026-09-28';
assert.equal(indiceDaSemana(SEG), 0);
assert.equal(indiceDaSemana(SEG2), 1);
assert.equal(indiceDaSemana(SEG5), 4);

// semanal: cai em toda segunda, nunca em terca
assert.ok(caiHoje({ days: [1] }, SEG));
assert.ok(caiHoje({ days: [1] }, SEG2));
assert.ok(!caiHoje({ days: [1] }, TER));

// quinzenal: alterna
assert.ok(caiHoje({ days: [1], interval_weeks: 2, week_offset: 0 }, SEG));
assert.ok(!caiHoje({ days: [1], interval_weeks: 2, week_offset: 0 }, SEG2));
assert.ok(caiHoje({ days: [1], interval_weeks: 2, week_offset: 0 }, SEG3));
// o offset serve pra nao empilhar dois quinzenais na mesma semana
assert.ok(!caiHoje({ days: [1], interval_weeks: 2, week_offset: 1 }, SEG));
assert.ok(caiHoje({ days: [1], interval_weeks: 2, week_offset: 1 }, SEG2));

// mensal: uma vez a cada 4 semanas
const mensal = { days: [1], interval_weeks: 4, week_offset: 0 };
assert.deepEqual([SEG, SEG2, SEG3, '2026-09-21', SEG5].map(d => caiHoje(mensal, d)),
  [true, false, false, false, true]);

// data anterior ao EPOCH nao pode quebrar por modulo negativo
assert.equal(typeof caiHoje({ days: [1], interval_weeks: 2 }, '2026-08-24'), 'boolean');
assert.ok(caiHoje({ days: [1], interval_weeks: 2, week_offset: 1 }, '2026-08-24'),
  'semana -1 e impar, entao offset 1 cai');

// sem days nao quebra
assert.equal(caiHoje(null, SEG), false);
assert.equal(caiHoje({}, SEG), false);
console.log('ok — rotina semanal, quinzenal e mensal · epoch', EPOCH_SEGUNDA);

// --- trimestral: a ADA manda trocar a escova a cada 3 a 4 meses -------------
const trimestral = { days: [6], interval_weeks: 12, week_offset: 0 };
const sabados = Array.from({ length: 26 }, (_, i) => {
  const d = new Date('2026-09-05T12:00:00'); d.setDate(d.getDate() + i * 7);
  return d.toISOString().slice(0, 10);
});
const caem = sabados.filter(d => caiHoje(trimestral, d));
// 26 semanas comportam 2 ou 3 ocorrencias de um ciclo de 12, conforme onde
// a janela cai. O que tem que ser exato e o INTERVALO entre elas.
assert.ok(caem.length >= 2 && caem.length <= 3, `esperava 2 ou 3, caiu ${caem.length}`);
for (let i = 1; i < caem.length; i++) {
  assert.equal((new Date(caem[i]) - new Date(caem[i - 1])) / 86400000, 84,
    'exatamente 12 semanas entre uma troca e a seguinte');
}
// offset separa dois trimestrais pra nao cairem no mesmo sabado
const outro = { days: [6], interval_weeks: 12, week_offset: 6 };
assert.ok(!sabados.some(d => caiHoje(trimestral, d) && caiHoje(outro, d)),
  'dois trimestrais com offset diferente nunca colidem');
console.log('ok — bimestral e trimestral');
