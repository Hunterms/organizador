// Checagem da expansao da grade e do calculo dos 75%.
// Roda com: node src/lib/attendance.test.mjs
import assert from 'node:assert/strict';
import { classDates, attendanceSummary } from './attendance.js';

// MC621: uma sexta de 4h. MS211: terca 2h + quinta 2h.
const mc621 = { id: 'a', code: 'MC621', class_schedule: [{ day: 5, time: '14:00', duration: 240, room: 'CC00' }] };
const ms211 = { id: 'b', code: 'MS211', class_schedule: [
  { day: 2, time: '19:00', duration: 120, room: 'PB13' },
  { day: 4, time: '21:00', duration: 120, room: 'CB10' }] };

// 2026-08-03 e segunda. Ate 2026-08-30 (domingo) sao 4 semanas cheias.
assert.equal(classDates(mc621, '2026-08-03', '2026-08-30').length, 4, 'MC621: 4 sextas em agosto');
assert.equal(classDates(ms211, '2026-08-03', '2026-08-30').length, 8, 'MS211: 4 tercas + 4 quintas');
assert.deepEqual(classDates(mc621, '2026-08-03', '2026-08-30').map(c => c.date),
  ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28']);

// Sem datas de semestre nao da pra expandir nada.
assert.equal(classDates(mc621, '', '2026-08-30').length, 0, 'sem inicio, lista vazia');

// Horas, nao ocorrencias: 4 sextas de 4h = 16h; limite = 4h.
const st = { semesterStart: '2026-08-03', semesterEnd: '2026-08-30' };
let a = attendanceSummary(mc621, [], st, '2026-08-30');
assert.equal(a.totalPlanned, 16, 'MC621: 16 horas-aula');
assert.equal(a.maxMisses, 4, '25% de 16h = 4h');
assert.equal(a.unmarked, 4, 'as 4 sextas passaram e nenhuma foi marcada');

// Uma falta na sexta de 4h ja estoura o limite de 4h.
a = attendanceSummary(mc621, [{ subjectId: 'a', date: '2026-08-07', status: 'absent' }], st, '2026-08-30');
assert.equal(a.absences, 4, 'bloco de 4h vale 4h de falta');
assert.equal(a.remaining, 0, 'sobrou zero');
assert.equal(a.unmarked, 3);

// Aula futura nao conta como em aberto.
a = attendanceSummary(mc621, [], st, '2026-08-10');
assert.equal(a.unmarked, 1, 'so a sexta 07 ja passou em 10/08');

// Sem datas de semestre: cai na estimativa de 16 semanas, e nao inventa pendencia.
a = attendanceSummary(ms211, [], {}, '2026-08-30');
assert.equal(a.totalPlanned, 64, '4h/semana x 16 semanas');
assert.equal(a.unmarked, 0, 'sem datas nao da pra saber o que passou');

// --- recorte proprio da materia ---------------------------------------------
// MC621 comeca 21/08, nao 10/08 como o resto do semestre.
const mc621tarde = { ...mc621, start_date: '2026-08-21', end_date: '2026-11-20' };
const d = classDates(mc621tarde, '2026-08-10', '2026-12-05');
assert.equal(d[0].date, '2026-08-21', 'nao conta a sexta 14/08');
assert.equal(d[d.length - 1].date, '2026-11-20', 'para em 20/11');
assert.equal(d.length, 14, 'MC621: 14 sextas de verdade');
assert.equal(d.reduce((n, c) => n + c.hours, 0), 56, '14 x 4h = 56h');

// EE400: Seg+Qua, com 5 datas canceladas no PDD.
const ee400 = { id: 'c', code: 'EE400', class_schedule: [
  { day: 1, time: '08:00', duration: 120, room: 'PE12' },
  { day: 3, time: '08:00', duration: 120, room: 'PE12' }],
  skip_dates: ['2026-08-12', '2026-09-07', '2026-10-12', '2026-10-28', '2026-11-02'] };
const ee = classDates(ee400, '2026-08-10', '2026-12-05');
for (const x of ee400.skip_dates) {
  assert.ok(!ee.some(c => c.date === x), `feriado ${x} nao pode virar aula`);
}
// Sem os 5 cancelamentos seriam 5 aulas a mais no denominador.
const semSkip = classDates({ ...ee400, skip_dates: [] }, '2026-08-10', '2026-12-05');
assert.equal(semSkip.length - ee.length, 5, 'os 5 cancelamentos saem da conta');

// E isso muda o limite de faltas de verdade.
const stSem = { semesterStart: '2026-08-10', semesterEnd: '2026-12-05' };
assert.ok(attendanceSummary(ee400, [], stSem).maxMisses
        < attendanceSummary({ ...ee400, skip_dates: [] }, [], stSem).maxMisses,
  'cancelar aula aperta o limite, nao afrouxa');

console.log('ok — presenca/faltas');

// --- os 4 degraus de cor ----------------------------------------------------
const { attendanceLevel, aulasRestantes } = await import('./attendance.js');
const nivel = (remaining, horasPorAula, maxMisses = 14) =>
  attendanceLevel({ remaining, weekHours: horasPorAula * 2, slots: 2, maxMisses });

assert.equal(nivel(0, 2), 'estourado');
assert.equal(nivel(2, 2), 'perigo', 'sobrou 1 aula');
assert.equal(nivel(3, 2), 'perigo', 'sobrou 1 aula e meia');
assert.equal(nivel(4, 2), 'atencao', 'sobraram 2 aulas');
assert.equal(nivel(6, 2), 'atencao', 'sobraram 3 aulas');
assert.equal(nivel(8, 2), 'ok', 'sobraram 4 aulas');
assert.equal(attendanceLevel({ maxMisses: 0 }), 'ok', 'materia sem aula nao alarma');
assert.equal(attendanceLevel(null), 'ok', 'sem resumo nao quebra');

// O ponto: a mesma porcentagem gasta pesa diferente conforme o tamanho da aula.
// MC621 e um bloco de 4h; EE400 sao aulas de 2h. Sobrando 6h nos dois:
const bloco4h = { remaining: 6, weekHours: 4, slots: 1, maxMisses: 14 };  // 1,5 aula
const aula2h = { remaining: 6, weekHours: 4, slots: 2, maxMisses: 14 };  // 3 aulas
assert.equal(attendanceLevel(bloco4h), 'perigo', 'bloco de 4h: 6h e so uma aula e meia');
assert.equal(attendanceLevel(aula2h), 'atencao', 'aula de 2h: 6h ainda sao 3 aulas');
assert.ok(aulasRestantes(bloco4h) < aulasRestantes(aula2h));

// Situacao real do Hunter se tivesse faltado agosto inteiro.
assert.equal(attendanceLevel({ remaining: 3, weekHours: 4, slots: 2, maxMisses: 15 }), 'perigo',
  'MC404 com 3h de folga: uma aula e meia, tem que acender');
console.log('ok — degraus de cor da falta');

// (o teste de gamificacao vive junto porque roda no mesmo comando)

// --- materia que ele nao frequenta nao acumula falta ------------------------
const naoVou = { id: 'z', code: 'EE400', attends: false,
  class_schedule: [{ day: 1, time: '08:00', duration: 120 }, { day: 3, time: '08:00', duration: 120 }] };
const rz = attendanceSummary(naoVou, [{ subjectId: 'z', date: '2026-08-10', status: 'absent' }],
  { semesterStart: '2026-08-10', semesterEnd: '2026-12-05' }, '2026-08-30');
assert.equal(rz.tracked, false, 'materia nao frequentada tem que vir marcada como nao rastreada');
assert.equal(rz.maxMisses, 0);
assert.equal(rz.absences, 0, 'falta antiga nao pode reaparecer na conta');
assert.equal(rz.unmarked, 0, 'nao pode cobrar presenca de aula que ele nao vai');
assert.equal(attendanceLevel(rz), 'ok', 'e nao pode acender alerta nenhum');
// Com attends true a mesma materia volta a contar.
const rv = attendanceSummary({ ...naoVou, attends: true }, [{ subjectId: 'z', date: '2026-08-10', status: 'absent' }],
  { semesterStart: '2026-08-10', semesterEnd: '2026-12-05' }, '2026-08-30');
assert.equal(rv.tracked, true);
assert.ok(rv.maxMisses > 0 && rv.absences === 2);
console.log('ok — materia sem controle de presenca');
