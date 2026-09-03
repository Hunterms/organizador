// Checagem do casamento curso -> materia. Roda com: node src/lib/classroom.test.mjs
//
// Este teste existe porque o import antigo CRIAVA materia quando nao casava o
// nome, e no caso real ele criaria 7 duplicadas: no app a materia se chama
// "MC426 A - Engenharia de Software" e no Classroom o curso e "G_MC426A_2026S2".
// As strings abaixo sao reais: sairam dos titulos das 65 tarefas importadas em
// 2026S1 e do CATEGORIES do feed do Moodle.
import assert from 'node:assert/strict';

// Copia da regra de classroom.js. A funcao mora la porque o modulo importa o
// cliente do Supabase, que nao roda em node puro.
const codigoDe = (texto) => (String(texto || '').match(/([A-Z]{2}\d{3})(?!\d)/) || [])[1] || null;

// --- os dois lados do casamento tem que dar o mesmo codigo ------------------
{
  // Lado Classroom / Moodle (formato real observado)
  assert.equal(codigoDe('G_MC426A_2026S2'), 'MC426');
  assert.equal(codigoDe('G_EE400A_2026S2'), 'EE400');
  assert.equal(codigoDe('G_MS211A_2026S1'), 'MS211');
  assert.equal(codigoDe('G_EA513A_2026S1'), 'EA513');
  assert.equal(codigoDe('G_MC536A+B_2026S1'), 'MC536', 'turma A+B nao pode quebrar');

  // Lado app (nomes reais das materias no banco)
  assert.equal(codigoDe('MC426 A - Engenharia de Software'), 'MC426');
  assert.equal(codigoDe('MC404 B - Organizacao Basica de Computadores'), 'MC404');
  assert.equal(codigoDe('MC621 A - Desafios de Programacao II'), 'MC621');

  // O par tem que fechar
  for (const [curso, materia] of [
    ['G_MC426A_2026S2', 'MC426 A - Engenharia de Software'],
    ['G_MS211A_2026S1', 'MS211 A - Calculo Numerico'],
  ]) {
    assert.equal(codigoDe(curso), codigoDe(materia), `${curso} tem que casar com ${materia}`);
  }
  console.log('ok — codigo sai igual dos dois lados');
}

// --- curso sem codigo nao pode virar materia nova ---------------------------
{
  // Este e real: uma das 65 tarefas antigas veio de "2026.1 Paradigmas de
  // Programacao", que nao tem codigo no nome. Antes viraria materia nova.
  assert.equal(codigoDe('2026.1 Paradigmas de Programacao'), null);
  assert.equal(codigoDe('Turma de Calouros 2026'), null);
  assert.equal(codigoDe(''), null);
  assert.equal(codigoDe(null), null);
  assert.equal(codigoDe(undefined), null);
  console.log('ok — sem codigo devolve null, e o import reporta em vez de criar');
}

// --- nao casa o que nao e codigo de materia --------------------------------
{
  assert.equal(codigoDe('2026S2'), null, 'ano nao e codigo');
  assert.equal(codigoDe('ABCD1234'), null, 'quatro letras e quatro numeros nao');
  assert.equal(codigoDe('mc426'), null, 'minuscula nao e o formato da DAC');
  assert.equal(codigoDe('X12'), null, 'uma letra e dois numeros nao');
  console.log('ok — nao inventa casamento');
}

// --- o primeiro codigo vence, e e o da materia ------------------------------
{
  // Titulo de atividade pode citar outra materia no meio.
  assert.equal(codigoDe('G_MC404A_2026S2: revisar antes de MS211'), 'MC404',
    'o codigo do curso vem primeiro e e ele que manda');
  console.log('ok — o primeiro codigo e o do curso');
}

console.log('ok — casamento curso/materia');
