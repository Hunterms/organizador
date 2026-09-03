// Checagem do parser de iCal. Roda com: node src/lib/ical.test.mjs
// O parser mora em supabase/functions/_shared/ical.js porque a edge function
// importa dele; o teste vive aqui, junto com o resto da suite.
import assert from 'node:assert/strict';
import { parseICS, instante, esforcoDe, semTitulos, desescapa }
  from '../../supabase/functions/_shared/ical.js';

const ics = (corpo) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${corpo}\r\nEND:VCALENDAR`;
const ev = (linhas) => `BEGIN:VEVENT\r\n${linhas.join('\r\n')}\r\nEND:VEVENT`;

// --- as tres formas de DTSTART ----------------------------------------------
{
  // UTC
  const a = instante('DTSTART:20260902T130000Z');
  assert.equal(a.ms, Date.UTC(2026, 8, 2, 13, 0));
  assert.equal(a.diaTodo, false);

  // com TZID de Sao Paulo: 10:00 local = 13:00 UTC
  const b = instante('DTSTART;TZID=America/Sao_Paulo:20260902T100000');
  assert.equal(b.ms, Date.UTC(2026, 8, 2, 13, 0));
  assert.equal(b.ms, a.ms, 'as duas formas tem que dar o mesmo instante');

  // dia todo
  const c = instante('DTSTART;VALUE=DATE:20260902');
  assert.equal(c.diaTodo, true);
  assert.equal(c.ms, Date.UTC(2026, 8, 2));

  // lixo nao explode
  assert.equal(instante('DTSTART:nao-e-data').ms, null);
  assert.equal(instante('sem dois pontos').ms, null);
  console.log('ok — UTC, TZID e dia todo dao o mesmo eixo');
}

// --- linha continuada: o caso que corta titulo de reuniao -------------------
{
  // No iCal a linha quebra em 75 colunas e a continuacao comeca com espaco.
  const t = ics(ev([
    'UID:abc',
    'DTSTART:20260902T130000Z',
    'SUMMARY:Alinhamento de arquitetura do SDK com o time de',
    ' pagamento e a squad de checkout',
  ]));
  const [e] = parseICS(t);
  assert.equal(e.titulo, 'Alinhamento de arquitetura do SDK com o time depagamento e a squad de checkout',
    'a continuacao tem que ser colada, nao perdida');
  assert.ok(!e.titulo.includes('\n'));
  console.log('ok — desdobra linha continuada');
}

// --- escape de texto --------------------------------------------------------
{
  assert.equal(desescapa('Reuniao\\, com virgula'), 'Reuniao, com virgula');
  assert.equal(desescapa('Linha1\\nLinha2'), 'Linha1 Linha2');
  assert.equal(desescapa('Ponto\\; e virgula'), 'Ponto; e virgula');
  console.log('ok — desescapa vírgula, ponto e vírgula e quebra');
}

// --- CANCELLED e evento incompleto ficam fora -------------------------------
{
  const t = ics([
    ev(['UID:1', 'DTSTART:20260902T130000Z', 'SUMMARY:Vale']),
    ev(['UID:2', 'DTSTART:20260902T140000Z', 'SUMMARY:Cancelada', 'STATUS:CANCELLED']),
    ev(['DTSTART:20260902T150000Z', 'SUMMARY:Sem uid']),
    ev(['UID:4', 'SUMMARY:Sem data']),
  ].join('\r\n'));
  const evs = parseICS(t);
  assert.equal(evs.length, 1, 'so o primeiro serve');
  assert.equal(evs[0].uid, '1');
  console.log('ok — descarta cancelada, sem uid e sem data');
}

// --- titulo ausente nao vira string vazia -----------------------------------
{
  const [e] = parseICS(ics(ev(['UID:x', 'DTSTART:20260902T130000Z'])));
  assert.equal(e.titulo, '(sem titulo)', 'tarefa sem titulo seria invisivel na lista');
  console.log('ok — titulo ausente tem rotulo');
}

// --- esforco pelo tamanho da reuniao ----------------------------------------
{
  const t0 = Date.UTC(2026, 8, 2, 13, 0);
  const min = (n) => t0 + n * 60000;
  assert.equal(esforcoDe(t0, min(15)), '10');
  assert.equal(esforcoDe(t0, min(30)), '30');
  assert.equal(esforcoDe(t0, min(60)), '60');
  assert.equal(esforcoDe(t0, min(120)), '120');
  assert.equal(esforcoDe(t0, null), '30', 'sem fim, assume meia hora');
  assert.equal(esforcoDe(t0, min(-30)), '30', 'fim antes do inicio nao quebra');
  // Todos os valores tem que existir no check da coluna
  const permitidos = new Set(['5', '10', '30', '60', '120']);
  for (const n of [5, 15, 25, 45, 90, 300]) {
    assert.ok(permitidos.has(esforcoDe(t0, min(n))), `esforco de ${n}min fora do check`);
  }
  console.log('ok — esforco sempre cai num valor que a coluna aceita');
}

// --- o feed livre/ocupado tem que ser detectado, nao importado -------------
{
  // Foi o caso real: o primeiro link mandado era /public/ e devolveu 2617
  // eventos com SUMMARY "Busy".
  const busy = parseICS(ics([
    ev(['UID:a', 'DTSTART:20260902T130000Z', 'SUMMARY:Busy']),
    ev(['UID:b', 'DTSTART:20260902T140000Z', 'SUMMARY:Busy']),
  ].join('\r\n')));
  assert.equal(semTitulos(busy), true, 'feed sem titulo tem que acusar');

  const misto = parseICS(ics([
    ev(['UID:a', 'DTSTART:20260902T130000Z', 'SUMMARY:Busy']),
    ev(['UID:b', 'DTSTART:20260902T140000Z', 'SUMMARY:Daily do CPF']),
  ].join('\r\n')));
  assert.equal(semTitulos(misto), false, 'um "Busy" no meio nao condena o feed');
  assert.equal(semTitulos([]), false, 'feed vazio nao e feed sem titulo');
  console.log('ok — detecta o feed publico livre/ocupado');
}

// --- arquivo vazio ou sem evento --------------------------------------------
{
  assert.deepEqual(parseICS(''), []);
  assert.deepEqual(parseICS(ics('')), []);
  console.log('ok — degrada sem explodir');
}

console.log('ok — parser de iCal');
