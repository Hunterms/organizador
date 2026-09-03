// Parser de iCal (RFC 5545), o pedaco do sync-agenda que da pra testar sozinho.
//
// Mora em `_shared` e e .js de proposito: o Deno da edge function importa daqui,
// e o node roda o teste no mesmo arquivo. Duas copias do mesmo parser era o
// jeito garantido de uma divergir da outra em silencio.
//
// Verificado contra o feed real de huntercarmo@dilettasolutions.com em
// 02/09/2026: 2617 eventos, zero RRULE (o Google ja expande as repeticoes no
// export, entao aqui nao precisa de motor de recorrencia).

// Texto de iCal vem escapado: \n \, \; \\
export const desescapa = (s) =>
  String(s).replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

/**
 * DTSTART/DTEND em tres formas:
 *   DTSTART:20260902T130000Z                       -> UTC
 *   DTSTART;TZID=America/Sao_Paulo:20260902T100000 -> local
 *   DTSTART;VALUE=DATE:20260902                    -> dia todo
 * Devolve millis UTC. Sem Z e sem TZID conhecido, assume Sao Paulo (UTC-3, sem
 * horario de verao desde 2019 — a mesma premissa que o push-cron.sql usa).
 */
export function instante(linha) {
  const i = String(linha).indexOf(':');
  if (i < 0) return { ms: null, diaTodo: false };
  const params = linha.slice(0, i);
  const valor = linha.slice(i + 1).trim();
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!m) return { ms: null, diaTodo: false };
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) return { ms: Date.UTC(+y, +mo - 1, +d), diaTodo: true };
  if (z) return { ms: Date.UTC(+y, +mo - 1, +d, +h, +mi), diaTodo: false };
  const tzid = (params.match(/TZID=([^;:]+)/) || [])[1];
  const offset = !tzid || tzid.includes('Sao_Paulo') ? 3 : 0;
  return { ms: Date.UTC(+y, +mo - 1, +d, +h + offset, +mi), diaTodo: false };
}

/** Eventos do arquivo. Ignora CANCELLED e evento sem UID ou sem DTSTART. */
export function parseICS(ics) {
  // Desdobrar linha continuada ANTES de tudo: no iCal a continuacao comeca com
  // espaco ou tab, e SUMMARY longo vem quebrado em 75 colunas. Sem isto, um
  // titulo de reuniao chega cortado no meio.
  const texto = String(ics).replace(/\r?\n[ \t]/g, '');
  const out = [];
  for (const bruto of texto.split('BEGIN:VEVENT').slice(1)) {
    const corpo = bruto.split('END:VEVENT')[0];
    const campo = (k) => (corpo.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, 'm')) || [])[1];
    const linha = (k) => (corpo.match(new RegExp(`^${k}(?:;[^:\\n]*)?:.*$`, 'm')) || [])[0];

    const uid = (campo('UID') || '').trim();
    const status = (campo('STATUS') || '').trim().toUpperCase();
    if (!uid || status === 'CANCELLED') continue;

    const dts = linha('DTSTART');
    if (!dts) continue;
    const ini = instante(dts);
    if (ini.ms == null) continue;
    const dte = linha('DTEND');

    out.push({
      uid,
      titulo: desescapa(campo('SUMMARY') || '') || '(sem titulo)',
      inicio: ini.ms,
      fim: dte ? instante(dte).ms : null,
      diaTodo: ini.diaTodo,
      local: desescapa(campo('LOCATION') || '').slice(0, 80),
    });
  }
  return out;
}

/** Esforco pelo tamanho real da reuniao. O check da coluna aceita 5/10/30/60/120. */
export function esforcoDe(ini, fim) {
  if (!ini || !fim || fim <= ini) return '30';
  const min = (fim - ini) / 60000;
  if (min <= 15) return '10';
  if (min <= 35) return '30';
  if (min <= 75) return '60';
  return '120';
}

/**
 * Feed publico com "ver apenas livre/ocupado" devolve TODO SUMMARY como "Busy".
 * Cinco tarefas chamadas "Busy" nao servem pra nada, entao isso tem que virar
 * erro visivel e nao importacao silenciosa. Foi o caso real do primeiro link
 * que o Hunter mandou em 02/09/2026.
 */
export const semTitulos = (evs) =>
  evs.length > 0 && evs.every((e) => /^(busy|ocupado)$/i.test(e.titulo));
