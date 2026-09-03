// ==========================================================================
// Evento com preparo: uma data que puxa tarefas ANTES dela.
//
// POR QUE ISTO E O UNICO CONCEITO NOVO DA COORDENACAO.
// O Hunter coordena quatro frentes. Tres delas cabem no que a casa ja tem:
//   - escala de midia do terreiro  -> custom_room + home_routine (rotacao)
//   - obrigacao com os guias       -> custom_room + home_routine (recorrencia)
//   - ritual semanal de CiX/DPS    -> custom_room + home_routine (recorrencia)
// `ensureTodayRoutineTasks` (store.js:467) ja le days, interval_weeks,
// week_offset, category, time, effort e place, e o proprio comentario dele diz
// que "a rotina deixou de ser so casa". Sao linhas de dado, nao codigo novo.
//
// A gira nao cabe. Ela nao e "toda quinta faca X": e um EVENTO numa data, e o
// preparo se espalha para tras a partir dela. Comprar material 3 dias antes,
// confirmar quem vem 2 dias antes, arrumar o salao 1 dia antes. Recorrencia
// responde "cai hoje?"; isto responde "o que a data de sabado exige de mim
// hoje?". Sao perguntas diferentes.
//
// O precedente na casa e a contagem regressiva de prova (generateReviewSchedule
// e intervaloCepeda), mas ela e amarrada em materia e devolve datas de revisao,
// nao itens de preparo. Dai o modulo proprio.
// ==========================================================================
import { caiHoje } from './rotina.js';

const shift = (dateKey, n) => {
  const d = new Date(dateKey + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * As datas em que o evento acontece, de `hoje` ate `hoje + horizonte`.
 * Aceita as duas formas: lista de datas cravadas, ou regra de recorrencia
 * (a mesma do home_routine, entao gira quinzenal sai de graca).
 */
export function ocorrencias(evento, hoje, horizonte) {
  const fim = shift(hoje, horizonte);
  const out = [];
  for (const d of evento.datas || []) {
    if (d >= hoje && d <= fim) out.push(d);
  }
  if (evento.recorrencia) {
    for (let i = 0; i <= horizonte; i++) {
      const d = shift(hoje, i);
      if (caiHoje(evento.recorrencia, d)) out.push(d);
    }
  }
  return [...new Set(out)].sort();
}

/**
 * O que os eventos exigem de mim HOJE.
 *
 * evento: {
 *   id, nome, categoria?, place?,
 *   datas?: ['YYYY-MM-DD'],                          // datas cravadas
 *   recorrencia?: { days, interval_weeks, week_offset }, // ou regra
 *   checklist: [{ titulo, diasAntes, effort?, time? }],
 * }
 *
 * Devolve item por item, com a data do evento junto: sem ela o titulo "comprar
 * material" nao diz pra QUAL gira, e no fim do mes ele tem tres abertas.
 */
export function preparoDeHoje(eventos, hoje) {
  const saida = [];
  const vistos = new Set();

  for (const ev of eventos || []) {
    const itens = (ev.checklist || []).filter(i => i && i.titulo);
    if (!itens.length) continue;
    // O horizonte sai do proprio checklist: item de 10 dias antes precisa que a
    // busca alcance 10 dias pra frente. Fixar um horizonte solto perderia item.
    const horizonte = Math.max(...itens.map(i => Math.max(0, i.diasAntes || 0)));

    for (const data of ocorrencias(ev, hoje, horizonte)) {
      for (const item of itens) {
        const dias = Math.max(0, item.diasAntes || 0);
        if (shift(data, -dias) !== hoje) continue;
        // Dedupe por evento+item+data: gira quinzenal cujas regras se sobrepoem
        // (datas cravadas MAIS recorrencia) geraria o item duas vezes.
        const chave = `${ev.id}|${item.titulo}|${data}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        saida.push({
          eventoId: ev.id,
          evento: ev.nome,
          data,
          diasAntes: dias,
          titulo: dias === 0 ? item.titulo : `${item.titulo} (${ev.nome} em ${dias}d)`,
          categoria: ev.categoria || 'terreiro',
          effort: item.effort || '30',
          time: item.time || '',
          place: ev.place || '',
        });
      }
    }
  }
  // Mais urgente primeiro: o que e pra hoje vem antes do que e pra semana que vem.
  return saida.sort((a, b) => a.data.localeCompare(b.data) || a.diasAntes - b.diasAntes);
}

/**
 * A proxima ocorrencia de cada evento, pra mostrar na tela sem gerar tarefa.
 * Serve pro "a gira e sabado" aparecer antes do preparo comecar.
 */
export function proximaOcorrencia(evento, hoje, horizonte = 60) {
  return ocorrencias(evento, hoje, horizonte)[0] || null;
}
