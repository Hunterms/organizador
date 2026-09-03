// ==========================================================================
// Importa ATIVIDADE do Google Classroom.
//
// RESTAURADO do commit c497c1c, com duas mudancas que sairam de medir o banco
// e o feed do Moodle em 02 e 03/09/2026.
//
// MUDANCA 1: nunca cria materia.
// O codigo antigo casava curso com materia pelo NOME normalizado e, nao
// achando, CRIAVA a materia. Os nomes nao casam: no app a materia e
// "MC426 A - Engenharia de Software" e no Classroom o curso e
// "G_MC426A_2026S2". Isso criaria 7 materias duplicadas em cima das 7 que
// existem, com topico e prova em nenhuma delas.
// Agora casa pelo CODIGO extraido dos dois lados. O formato veio do feed real
// do Moodle (`CATEGORIES:G_EE400A_2026S2`) e dos titulos das 65 tarefas
// antigas (`G_MS211A_2026S1: Projeto Computacional 1`). Curso sem codigo
// reconhecivel entra no relatorio como nao casado, e nao vira materia nova:
// duplicar materia e pior que deixar uma atividade de fora.
//
// MUDANCA 2: amarra a tarefa na materia.
// O import antigo gravava a tarefa sem `subject_id`. Sem isso, `retorno.js`
// nao consegue somar hora por materia e a tarefa nao pertence a nada.
//
// O QUE FOI MANTIDO, porque estava certo:
//  - dedupe por `classroom_coursework_id`
//  - ATUALIZA data e hora quando o professor move o prazo (era a duvida do
//    Hunter: "as atividades mudam a cada 3 dias, como resolve?")
//  - respeita `dismissed`: tarefa que ele apagou nao volta
//  - ignora rascunho (state != PUBLISHED) e item sem prazo
// ==========================================================================
import { supabase } from './supabase';
import { gGet } from './google';

const API = 'https://classroom.googleapis.com/v1';

// G_MC426A_2026S2 -> MC426 · "MC426 A - Engenharia de Software" -> MC426
export const codigoDe = (texto) => (String(texto || '').match(/([A-Z]{2}\d{3})(?!\d)/) || [])[1] || null;

const dataDe = (d) => (d?.year && d?.month && d?.day)
  ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  : null;

// dueTime do Classroom vem em UTC. Sem minutos, o Google omite o campo.
const horaDe = (t) => {
  if (t?.hours == null) return null;
  const d = new Date(Date.UTC(2000, 0, 1, t.hours, t.minutes || 0));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
};

export async function importaClassroom(userId, state, opts = {}) {
  const r = { criadas: 0, atualizadas: 0, cursos: 0, semCodigo: [], erros: [] };

  const cursos = (await gGet(`${API}/courses?courseStates=ACTIVE`, opts)).courses || [];
  r.cursos = cursos.length;
  if (!cursos.length) return r;

  // Materia por codigo. Inclui as arquivadas de proposito: se ele dispensou
  // MC536, atividade de MC536 nao deve voltar por outra porta.
  const { data: materias } = await supabase
    .from('subjects').select('id, name, code, classroom_course_id, dismissed')
    .eq('user_id', userId);
  const porCodigo = new Map();
  for (const s of materias || []) {
    const c = s.code || codigoDe(s.name);
    if (c) porCodigo.set(c, s);
  }

  // Tarefas ja importadas, pra dedupe e pra saber o que mudou.
  const { data: jaTem } = await supabase
    .from('tasks').select('id, classroom_coursework_id, date, time, dismissed')
    .eq('user_id', userId).not('classroom_coursework_id', 'is', null);
  const porCW = new Map((jaTem || []).map((t) => [t.classroom_coursework_id, t]));

  for (const curso of cursos) {
    const cod = codigoDe(curso.name) || codigoDe(curso.section);
    const materia = cod ? porCodigo.get(cod) : null;

    if (!materia) { r.semCodigo.push(curso.name); continue; }
    if (materia.dismissed) continue;

    // Amarra o curso na materia na primeira vez, pra proxima rodada nao
    // depender de regex.
    if (!materia.classroom_course_id) {
      await supabase.from('subjects')
        .update({ classroom_course_id: curso.id }).eq('id', materia.id);
    }

    let trabalhos = [];
    try {
      trabalhos = (await gGet(`${API}/courses/${curso.id}/courseWork?orderBy=dueDate`, opts)).courseWork || [];
    } catch (e) {
      // Curso sem coursework, ou sem permissao: nao e motivo pra abortar o resto.
      r.erros.push(`${cod}: ${e.message}`);
      continue;
    }

    for (const cw of trabalhos) {
      if (cw.state !== 'PUBLISHED') continue;
      const data = dataDe(cw.dueDate);
      if (!data) continue;              // sem prazo nao ha o que agendar
      const hora = horaDe(cw.dueTime);

      const existente = porCW.get(cw.id);
      if (existente) {
        if (existente.dismissed) continue;
        // Prazo movido: corrige a linha em vez de criar outra.
        if (existente.date !== data || (existente.time || null) !== hora) {
          const { error } = await supabase.from('tasks')
            .update({ date: data, time: hora }).eq('id', existente.id);
          if (error) r.erros.push(`${cw.title}: ${error.message}`);
          else r.atualizadas++;
        }
        continue;
      }

      const { error } = await supabase.from('tasks').insert({
        user_id: userId,
        title: `${cod}: ${cw.title}`.slice(0, 200),
        category: 'estudos',
        effort: cw.workType === 'ASSIGNMENT' ? '120' : '60',
        time: hora,
        date: data,
        done: false,
        recurring: false,
        subject_id: materia.id,
        classroom_coursework_id: cw.id,
        source: 'classroom',
      });
      if (error) r.erros.push(`${cw.title}: ${error.message}`);
      else r.criadas++;
    }
  }

  await supabase.from('profiles')
    .update({ classroom_last_synced_at: new Date().toISOString() }).eq('id', userId);
  return r;
}
