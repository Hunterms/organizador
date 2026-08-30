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
