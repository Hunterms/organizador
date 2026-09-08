import assert from 'node:assert/strict';
import { ordenaColunas, estaFazendo } from './trabalho.js';

// O caso que quebra board de coluna fixa: dois tipos no mesmo quadro, com
// fluxos diferentes. As duas sequencias tem que caber, cada uma na sua ordem.
const mistos = [
  { coluna: 'In Progress', estados: ['To Do', 'In Progress', 'Done', 'Removed'] },
  { coluna: 'Committed', estados: ['New', 'Approved', 'Committed', 'Done', 'Removed'] },
];
assert.deepEqual(
  ordenaColunas(mistos),
  ['To Do', 'In Progress', 'Done', 'New', 'Approved', 'Committed'],
  'ordem do fluxo de cada tipo, sem Removed e sem repetir Done',
);

// Card sem a lista de estados (sync falhou em buscar) nao pode sumir da tela.
assert.deepEqual(ordenaColunas([{ coluna: 'Triage', estados: [] }]), ['Triage']);
assert.deepEqual(ordenaColunas([{ coluna: 'Triage' }]), ['Triage']);
assert.deepEqual(ordenaColunas([]), []);

// So Removed: some, e o board fica vazio em vez de mostrar lixo.
assert.deepEqual(ordenaColunas([{ coluna: 'Removed', estados: ['Removed'] }]), []);

// A regra que decide se a work item vira linha do dia. Os dois vocabularios
// contam, e a comparacao ignora caixa porque o Azure escreve "In Progress" mas
// o card guarda o que o time digitou.
assert.equal(estaFazendo('In Progress'), true);
assert.equal(estaFazendo('Committed'), true, 'Product Backlog Item comecado');
assert.equal(estaFazendo('in progress'), true);
assert.equal(estaFazendo('New'), false);
assert.equal(estaFazendo('To Do'), false, 'fila nao e trabalho de hoje');
assert.equal(estaFazendo('Done'), false);
assert.equal(estaFazendo(undefined), false);

console.log('trabalho: ok');
