// Checagem da gamificacao. Roda com: node src/lib/gamification.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./gamification.js', import.meta.url), 'utf8');

// --- XP tem que seguir a evidencia, nao a facilidade de clicar ---------------
const xp = Object.fromEntries(
  [...src.match(/const XP = \{([^}]*)\}/)[1].matchAll(/(\w+):\s*(\d+)/g)].map(m => [m[1], +m[2]]));
assert.ok(xp.retrieval > xp.pomodoro, 'retrieval practice tem a utilidade mais alta (Dunlosky): tem que liderar');
assert.ok(xp.pomodoro > xp.task, '50min de foco tem que valer mais que marcar uma caixinha');
assert.ok(xp.task > xp.water, 'beber agua nao pode render mais que uma tarefa feita');
assert.ok(xp.retrieval >= 4 * xp.water, 'a distancia entre aprender e hidratar tem que ser visivel');

// --- resiliencia: existe um numero que um dia ruim nao zera ------------------
assert.ok(src.includes('ativos30'), 'falta a metrica que sobrevive a um dia perdido');
assert.ok(/for \(let i = 0, d = today; i < 30/.test(src), 'ativos30 tem que varrer 30 dias');

// --- o piso do streak nao pode ser so "marcou caixinha" ---------------------
assert.ok(/tasksOk \|\| \(focus\[date\] \|\| 0\) >= 1/.test(src),
  'um pomodoro de foco sozinho tem que segurar o dia');
console.log('ok — gamificacao');
