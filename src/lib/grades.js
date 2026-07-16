// Evaluate a free-form grade formula against a subject's provas/atividades.
// Available names: P1..Pn (provas, in date order), A1..An (atividades),
// media(x)/soma(x) helpers, provas/atividades (arrays of the entered grades),
// num_provas/num_atividades (counts). Example: (P1 + P2 + media(atividades)) / 3
//
// The formula is the user's own input on their own device; we still sanitize
// to a math-only character set before eval so a typo can't run arbitrary code.
const SAFE = /^[0-9+\-*/(). ,A-Za-z_]+$/;

export function computeMedia(formula, provas, atividades) {
  if (!formula || !formula.trim()) return { value: null };
  if (!SAFE.test(formula)) return { error: 'Formula com caractere invalido.' };

  const gradeList = (items) => items.map(x => (x.grade == null ? null : Number(x.grade)));
  const provaGrades = gradeList(provas);
  const ativGrades = gradeList(atividades);
  const clean = (arr) => arr.filter(x => x != null && isFinite(x));
  const mean = (arr) => { const c = clean(arr); return c.length ? c.reduce((s, x) => s + x, 0) / c.length : 0; };
  const sum = (arr) => clean(arr).reduce((s, x) => s + x, 0);

  const scope = {
    media: (a) => Array.isArray(a) ? mean(a) : 0,
    soma: (a) => Array.isArray(a) ? sum(a) : 0,
    provas: provaGrades,
    atividades: ativGrades,
    num_provas: clean(provaGrades).length,
    num_atividades: clean(ativGrades).length,
  };
  // Expose P1..P9 / A1..A9 always (0 when missing) so a formula written before
  // all grades exist still validates.
  for (let i = 1; i <= 9; i++) { scope['P' + i] = provaGrades[i - 1] ?? 0; scope['A' + i] = ativGrades[i - 1] ?? 0; }

  // Allowlist: every identifier in the formula must be a known name. Blocks
  // access to globals (window/fetch/localStorage/process) — no arbitrary code.
  const allowed = new Set(Object.keys(scope));
  const ids = formula.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  for (const id of ids) if (!allowed.has(id)) return { error: `Nome desconhecido: ${id}` };

  try {
    const keys = Object.keys(scope);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `"use strict"; return (${formula});`);
    const val = fn(...keys.map(k => scope[k]));
    if (typeof val !== 'number' || !isFinite(val)) return { error: 'Resultado nao numerico.' };
    return { value: val };
  } catch {
    return { error: 'Nao consegui avaliar a formula.' };
  }
}
