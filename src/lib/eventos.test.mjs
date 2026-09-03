// Checagem do preparo de evento. Roda com: node src/lib/eventos.test.mjs
import assert from 'node:assert/strict';
import { preparoDeHoje, ocorrencias, proximaOcorrencia } from './eventos.js';

// 2026-09-05 e sabado. EPOCH_SEGUNDA do rotina.js e 2026-08-31.
const gira = {
  id: 'g', nome: 'Gira', categoria: 'terreiro', place: 'Barao Geraldo',
  datas: ['2026-09-05'],
  checklist: [
    { titulo: 'Comprar material', diasAntes: 3, effort: '60' },
    { titulo: 'Confirmar quem vem', diasAntes: 2 },
    { titulo: 'Arrumar o salao', diasAntes: 1, effort: '120' },
    { titulo: 'Gira', diasAntes: 0 },
  ],
};

// --- cada item cai no seu dia, e nao no dia do evento ----------------------
{
  assert.equal(preparoDeHoje([gira], '2026-09-01').length, 0, '4 dias antes: nada ainda');
  const d2 = preparoDeHoje([gira], '2026-09-02');
  assert.equal(d2.length, 1);
  assert.equal(d2[0].titulo, 'Comprar material (Gira em 3d)');
  assert.equal(d2[0].effort, '60');
  assert.equal(d2[0].place, 'Barao Geraldo', 'o lugar do evento desce pro item');
  assert.equal(preparoDeHoje([gira], '2026-09-03')[0].titulo, 'Confirmar quem vem (Gira em 2d)');
  assert.equal(preparoDeHoje([gira], '2026-09-04')[0].titulo, 'Arrumar o salao (Gira em 1d)');
  console.log('ok — o preparo se espalha pra tras a partir da data');
}

// --- no dia, o titulo nao leva sufixo ---------------------------------------
{
  const dia = preparoDeHoje([gira], '2026-09-05');
  assert.equal(dia.length, 1);
  assert.equal(dia[0].titulo, 'Gira', 'no dia nao faz sentido dizer "em 0d"');
  assert.equal(dia[0].diasAntes, 0);
  console.log('ok — item do dia sem sufixo');
}

// --- depois do evento, silencio ---------------------------------------------
{
  assert.equal(preparoDeHoje([gira], '2026-09-06').length, 0, 'gira passada nao cobra nada');
  console.log('ok — evento passado nao gera tarefa');
}

// --- a data do evento vai no titulo: com 3 giras abertas, sem ela nao da ----
{
  const tres = { ...gira, datas: ['2026-09-05', '2026-09-19', '2026-10-03'] };
  // 2026-09-16 e 3 dias antes de 19, e nada mais
  const p = preparoDeHoje([tres], '2026-09-16');
  assert.equal(p.length, 1);
  assert.equal(p[0].data, '2026-09-19', 'o item tem que saber de qual gira ele e');
  console.log('ok — item carrega a data do evento');
}

// --- dois itens no mesmo dia, de eventos diferentes -------------------------
{
  const outro = { id: 'o', nome: 'Festa de Cosme', datas: ['2026-09-06'],
    checklist: [{ titulo: 'Comprar doce', diasAntes: 4 }] };
  const p = preparoDeHoje([gira, outro], '2026-09-02');
  assert.equal(p.length, 2, 'gira em 3d e festa em 4d caem no mesmo dia');
  assert.deepEqual(p.map(x => x.evento), ['Gira', 'Festa de Cosme'],
    'o mais proximo primeiro');
  console.log('ok — dois eventos no mesmo dia, ordenados pelo mais proximo');
}

// --- recorrencia: gira quinzenal sai de graca do rotina.js -----------------
{
  const quinzenal = {
    id: 'q', nome: 'Gira quinzenal',
    recorrencia: { days: [6], interval_weeks: 2, week_offset: 0 },  // sabado, semana par
    checklist: [{ titulo: 'Arrumar o salao', diasAntes: 1 }],
  };
  // EPOCH e segunda 2026-08-31 -> semana 0. Sabado dessa semana: 2026-09-05.
  const occ = ocorrencias(quinzenal, '2026-09-01', 30);
  assert.ok(occ.includes('2026-09-05'), 'sabado da semana 0 tem que cair');
  assert.ok(!occ.includes('2026-09-12'), 'sabado da semana 1 nao cai (quinzenal)');
  assert.ok(occ.includes('2026-09-19'), 'sabado da semana 2 cai');
  const p = preparoDeHoje([quinzenal], '2026-09-04');
  assert.equal(p.length, 1, 'sexta antes da gira de sabado');
  console.log('ok — recorrencia reusa o motor do rotina.js');
}

// --- data cravada MAIS recorrencia nao duplica o item ----------------------
{
  const dobrado = {
    id: 'd', nome: 'Gira', datas: ['2026-09-05'],
    recorrencia: { days: [6], interval_weeks: 1 },   // todo sabado, inclui 05
    checklist: [{ titulo: 'Arrumar o salao', diasAntes: 1 }],
  };
  const p = preparoDeHoje([dobrado], '2026-09-04');
  assert.equal(p.length, 1, 'as duas regras apontam pro mesmo sabado: um item so');
  console.log('ok — dedupe entre data cravada e recorrencia');
}

// --- horizonte sai do checklist, nao de um numero solto -------------------
{
  const longe = { id: 'l', nome: 'Festa grande', datas: ['2026-10-15'],
    checklist: [{ titulo: 'Encomendar as guias', diasAntes: 30 }] };
  const p = preparoDeHoje([longe], '2026-09-15');
  assert.equal(p.length, 1, 'item de 30 dias antes precisa de horizonte de 30');
  assert.equal(p[0].titulo, 'Encomendar as guias (Festa grande em 30d)');
  console.log('ok — horizonte derivado do maior diasAntes');
}

// --- degrada sem explodir ---------------------------------------------------
{
  assert.deepEqual(preparoDeHoje([], '2026-09-05'), []);
  assert.deepEqual(preparoDeHoje(null, '2026-09-05'), []);
  assert.deepEqual(preparoDeHoje([{ id: 'x', nome: 'Vazio', datas: ['2026-09-05'] }], '2026-09-05'), [],
    'evento sem checklist nao gera nada');
  assert.deepEqual(preparoDeHoje([{ id: 'y', nome: 'Sem data', checklist: [{ titulo: 'a', diasAntes: 1 }] }], '2026-09-05'), [],
    'evento sem data nem recorrencia nao gera nada');
  assert.equal(proximaOcorrencia({ id: 'z', nome: 'n' }, '2026-09-05'), null);
  console.log('ok — degrada sem explodir');
}

// --- proxima ocorrencia, pra mostrar antes do preparo comecar ---------------
{
  assert.equal(proximaOcorrencia(gira, '2026-09-01'), '2026-09-05');
  assert.equal(proximaOcorrencia(gira, '2026-09-06'), null, 'sem gira futura no horizonte');
  console.log('ok — proxima ocorrencia');
}

console.log('ok — eventos');
