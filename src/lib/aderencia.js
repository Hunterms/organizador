// ==========================================================================
// Aderencia: quanto do plano vira trabalho, e onde ele morre.
//
// POR QUE ISTO EXISTE.
// O canon otimiza o VALOR da sessao (regra 3: bloco de 50min, nunca menos,
// "porque o custo de entrar no assunto come a sessao") e nunca mediu a
// PROBABILIDADE de ela comecar. O valor esperado e P(comecar) x valor: um bloco
// de 50 que comeca 40% das vezes perde de um de 15 que comeca 90%.
//
// Steel (2007), 691 correlacoes em 216 amostras, poe **aversao a tarefa** entre
// os preditores mais fortes de procrastinacao. Sirois e Pychyl: procrastinar e
// reparo de humor de curto prazo, nao falha de agenda. Nenhum dos dois se
// resolve escalonando melhor, que e a unica coisa que este app sabia fazer.
//
// A DECOMPOSICAO E O PONTO.
// "Nao fechou" junta dois problemas diferentes:
//   - INTOCADO (zero pomodoro): ele nao abriu. Isso e aversao ou impulsividade.
//   - COMECADO (pomodoro parcial): ele abriu e desistiu. Isso e outra coisa:
//     bloco grande demais, cansaco, ou interrupcao.
// A intervencao dos dois e oposta, entao somar os dois esconde a resposta.
// ==========================================================================
import { effectiveDone } from './gamification.js';

const SEMANAS = 4;
// Dois portoes, nao um. Medido no banco em 02/09/2026: os 10 primeiros blocos
// do planejador cabiam em TRES dias (31/08 a 02/09), todos sem pomodoro. Com
// MIN_N=10 sozinho a regua cuspiria "aversao" a partir de uma feature de tres
// dias de idade — que e exatamente a leitura conveniente que ela existe pra
// impedir. Aversao e padrao, e padrao precisa de tempo, nao so de volume.
const MIN_N = 20;        // blocos na janela
const MIN_DIAS = 14;     // e espalhados por pelo menos duas semanas

const shift = (s, n) => {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const taxaDe = (parte, total) => (total ? parte / total : null);

/**
 * @param tasks    tarefas do estado
 * @param hoje     'YYYY-MM-DD'. Nao entra: o dia esta em curso.
 * @param semanas  janela para tras
 */
export function aderencia(tasks, hoje, semanas = SEMANAS) {
  const inicio = shift(hoje, -(semanas * 7));
  const blocos = (tasks || []).filter(t =>
    t.category === 'estudos' && t.date && t.date >= inicio && t.date < hoje);

  const bucket = () => ({ total: 0, fechados: 0, comecados: 0, intocados: 0 });
  const geral = bucket();
  const porDow = Array.from({ length: 7 }, bucket);
  const porHora = {};

  for (const t of blocos) {
    const dow = new Date(t.date + 'T12:00:00').getDay();
    const hora = (t.time || '').slice(0, 2);
    porHora[hora] = porHora[hora] || bucket();
    const alvos = [geral, porDow[dow], porHora[hora]];
    for (const b of alvos) b.total++;

    if (effectiveDone(t)) { for (const b of alvos) b.fechados++; continue; }
    // Nao fechou. Abriu ou nem abriu?
    const feitos = t.pomodoros_done || 0;
    for (const b of alvos) (feitos > 0 ? b.comecados++ : b.intocados++);
  }

  // O veredito que eu me comprometi a respeitar antes de ver o numero, pra nao
  // ficar interpretando o resultado depois que ele chega:
  //   >= 75% fechados  -> a regra 3 do canon esta certa, nao mexer
  //   <  50% fechados  -> a aversao esta ganhando, o bloco precisa de porta menor
  //   entre os dois    -> nao decide
  const taxa = taxaDe(geral.fechados, geral.total);
  // Espalhamento real dos blocos observados, nao o tamanho da janela pedida.
  const datas = [...new Set(blocos.map(t => t.date))].sort();
  const span = datas.length
    ? Math.round((new Date(datas[datas.length - 1] + 'T12:00:00')
        - new Date(datas[0] + 'T12:00:00')) / 86400000) + 1
    : 0;
  const base = geral.total >= MIN_N && span >= MIN_DIAS;
  let veredito = 'indefinido';
  if (base && taxa != null) {
    if (taxa >= 0.75) veredito = 'canon';
    else if (taxa < 0.5) veredito = 'aversao';
  }

  return {
    ...geral,
    taxa,
    // Aparecer conta: um pomodoro ja segura o dia no streak (gamification.keptDay).
    taxaAparecimento: taxaDe(geral.fechados + geral.comecados, geral.total),
    // Qual dos dois modos de falha domina. Decide a intervencao.
    modoDeFalha: !base ? null
      : (geral.intocados > geral.comecados ? 'nem abriu' : 'abriu e parou'),
    veredito,
    baseSuficiente: base,
    diasObservados: span,
    porDow: porDow.map((b, dow) => ({ dow, ...b, taxa: taxaDe(b.fechados, b.total) })),
    porHora: Object.entries(porHora)
      .map(([hora, b]) => ({ hora, ...b, taxa: taxaDe(b.fechados, b.total) }))
      .sort((a, b) => a.hora.localeCompare(b.hora)),
  };
}

/**
 * O pior horario e o melhor horario, entre os que tem base. Serve pra hora
 * ancora deixar de ser escolhida so por estar livre na agenda e passar a
 * considerar onde ele de fato aparece.
 */
export function horariosQueRendem(tasks, hoje, semanas = SEMANAS, minN = 3) {
  const { porHora } = aderencia(tasks, hoje, semanas);
  const comBase = porHora.filter(h => h.total >= minN && h.hora);
  if (comBase.length < 2) return null;
  const ord = [...comBase].sort((a, b) => b.taxa - a.taxa);
  return { melhor: ord[0], pior: ord[ord.length - 1] };
}
