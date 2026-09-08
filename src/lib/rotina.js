// Decide se um item da rotina cai HOJE. Logica pura, sem banco e sem React,
// porque ela roda em dois lugares: no app (store.js) e no servidor
// (functions/send-push). Se os dois discordarem, a tarefa duplica ou some.
// Ver src/lib/rotina.test.mjs.

// Segunda-feira fixa. A contagem de semanas sai daqui, entao nao precisa de
// coluna de ancora por linha e o resultado nunca depende de quando foi criado.
export const EPOCH_SEGUNDA = '2026-08-31';

export function indiceDaSemana(dateKey) {
  const dias = Math.floor(
    (new Date(dateKey + 'T12:00:00') - new Date(EPOCH_SEGUNDA + 'T12:00:00')) / 86400000);
  return Math.floor(dias / 7);
}

/**
 * cfg: { days: int[], interval_weeks?: 1|2|4, week_offset?: number }
 * Cai hoje quando o dia da semana bate E a semana esta no ciclo.
 */
export function caiHoje(cfg, dateKey) {
  if (!cfg || !Array.isArray(cfg.days)) return false;
  const dow = new Date(dateKey + 'T12:00:00').getDay();
  if (!cfg.days.includes(dow)) return false;
  const intervalo = cfg.interval_weeks || 1;
  if (intervalo === 1) return true;
  const semana = indiceDaSemana(dateKey);
  // Modulo de negativo em JS volta negativo; datas antes do EPOCH existem.
  return ((semana % intervalo) + intervalo) % intervalo === (cfg.week_offset || 0) % intervalo;
}

/**
 * O que a rotina PORIA num dia, sem gravar nada.
 *
 * Mora aqui, e nao no store, pela mesma razao do caiHoje: e logica pura e
 * precisa ser testavel sem banco. `labelFor(key)` devolve o titulo ou null —
 * chave orfa e pulada, igual ao dia real faz.
 */
export function rotinaPrevista(dateKey, homeRoutine, labelFor) {
  const out = [];
  for (const [key, cfg] of Object.entries(homeRoutine || {})) {
    if (!caiHoje(cfg, dateKey)) continue;
    const title = labelFor(key);
    if (!title) continue;
    out.push({
      key, title,
      category: cfg.category || 'casa',
      effort: cfg.effort || '30',
      time: cfg.time || '',
      place: cfg.place || '',
    });
  }
  return out;
}
