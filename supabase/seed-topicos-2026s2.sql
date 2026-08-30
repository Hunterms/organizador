-- ==========================================================================
-- Seed: topicos de cada materia, tirados do programa de cada PDD.
-- E a lista do "o que eu tenho que aprender". O planejador semanal
-- (src/lib/weekPlan.js) escolhe daqui o topico de cada bloco de 50min.
--
-- Nao precisa editar nada se voce so tem uma conta no projeto Supabase.
-- Idempotente. Rode depois de seed-grade-2026s2.sql.
-- ==========================================================================
do $$
declare
  uid uuid;
  r record;
  sid uuid;
begin
  -- Conta unica no projeto: acha sozinho, nao precisa editar nada.
  -- Mais de uma conta: para e avisa, em vez de semear na errada.
  if (select count(*) from auth.users) = 1 then
    select id into uid from auth.users limit 1;
  else
    select id into uid from auth.users where email = 'TROQUE_PELO_SEU_EMAIL';
  end if;
  if uid is null then
    raise exception 'Ha % contas em auth.users. Troque TROQUE_PELO_SEU_EMAIL pelo seu email de login.',
      (select count(*) from auth.users);
  end if;

  for r in
    select * from (values
      ('EE400', 'Geometria analitica: vetores, retas, planos, curvas e superficies', 1),
      ('EE400', 'Calculo de varias variaveis: gradiente, otimizacao, integrais multiplas', 2),
      ('EE400', 'Calculo vetorial: integrais de linha, Green, Stokes, Gauss', 3),
      ('EE400', 'Introducao as EDPs: classificacao e separacao de variaveis', 4),
      ('EE400', 'Numeros complexos: forma exponencial, raizes, regioes no plano', 5),
      ('EE400', 'Funcoes holomorfas: Cauchy-Riemann, funcoes elementares', 6),
      ('EE400', 'Integrais e polinomios: Cauchy-Goursat, formula integral de Cauchy', 7),
      ('EE400', 'Series: potencias, Taylor e Laurent', 8),
      ('EE400', 'Singularidades: polos, residuos, teorema dos residuos', 9),
      ('EE400', 'Aplicacoes de residuos: integrais improprias', 10),
      ('EE400', 'Transformacoes conformes', 11),
      ('MC426', 'U0: Introducao a Engenharia de Software e visao sociotecnica', 1),
      ('MC426', 'U1: Processos de software', 2),
      ('MC426', 'U2: Gerencia de configuracao de software', 3),
      ('MC426', 'U3: Engenharia de requisitos', 4),
      ('MC426', 'U4: Analise e projeto de sistemas de software', 5),
      ('MC426', 'U5: Teste de software e liberacao', 6),
      ('MC404', 'Organizacao basica de computadores', 1),
      ('MC404', 'Memoria e enderecamento', 2),
      ('MC404', 'Representacao de informacoes na memoria', 3),
      ('MC404', 'Introducao a arquitetura de processadores', 4),
      ('MC404', 'Conjunto de instrucoes: memoria, aritmeticas, logicas, deslocamento', 5),
      ('MC404', 'Programacao em linguagem de montagem (RISC-V)', 6),
      ('MC404', 'Instrucoes de entrada/saida, interrupcoes e perifericos', 7),
      ('MC404', 'Pilha, procedimentos e funcoes', 8),
      ('MC404', 'Passagem de parametros: registradores e pilha, valor e referencia', 9),
      ('MC404', 'Montadores e ligadores', 10),
      ('MC621', 'Introducao a programacao competitiva', 1),
      ('MC621', 'Estruturas de dados e bibliotecas', 2),
      ('MC621', 'Busca exaustiva', 3),
      ('MC621', 'Divisao e conquista', 4),
      ('MC621', 'Algoritmos gulosos', 5),
      ('MC621', 'Programacao dinamica', 6),
      ('MC621', 'Grafos', 7),
      ('MC621', 'Matematica discreta: exponenciacao rapida, primalidade, aritmetica modular', 8),
      ('MC621', 'Cadeias de caracteres: busca, alinhamento, arvore e vetores de sufixos', 9),
      ('MC621', 'Geometria computacional: objetos, circulos, triangulos e poligonos', 10),
      ('MS211', 'Aritmetica de ponto flutuante', 1),
      ('MS211', 'Zeros de funcoes reais', 2),
      ('MS211', 'Sistemas lineares', 3),
      ('MS211', 'Interpolacao polinomial', 4),
      ('MS211', 'Integracao numerica', 5),
      ('MS211', 'Quadrados minimos lineares', 6),
      ('MS211', 'Tratamento numerico de equacoes diferenciais ordinarias', 7),
      ('MC919', 'Fundamentos: filtragem, deteccao de bordas, reamostragem', 1),
      ('MC919', 'Pontos de interesse e invariancia: Harris, descritores, correspondencia', 2),
      ('MC919', 'Geometria e transformacoes: alinhamento, RANSAC', 3),
      ('MC919', 'Modelos de camera e projecao: single view geometry, panoramas', 4),
      ('MC919', 'Estereo e reconstrucao 3D: luz, multiview stereo', 5),
      ('MC919', 'Fotometria e Structure from Motion', 6),
      ('MC919', 'Reconhecimento de padroes e CNNs', 7),
      ('MC919', 'Redes neurais profundas e vision transformers', 8),
      ('MC919', 'Geracao de imagens: NeRF e modelos de difusao', 9),
      ('MC919', 'Etica e impactos sociais em visao computacional', 10),
      ('EA513', 'Conceitos fundamentais: carga, corrente, tensao e potencia', 1),
      ('EA513', 'Fontes independentes ideais e Lei de Ohm', 2),
      ('EA513', 'Leis de Kirchhoff (LKC e LKT)', 3),
      ('EA513', 'Divisores de corrente e de tensao', 4),
      ('EA513', 'Conversoes Y-Delta', 5),
      ('EA513', 'Fontes controladas/dependentes', 6),
      ('EA513', 'Metodo de analise nodal', 7),
      ('EA513', 'Analise nodal com fontes de tensao', 8),
      ('EA513', 'Metodo de analise de malhas', 9),
      ('EA513', 'Linearidade e principio da superposicao', 10),
      ('EA513', 'Teoremas de Thevenin e Norton', 11),
      ('EA513', 'Maxima transferencia de potencia', 12),
      ('EA513', 'Capacitores e indutores', 13),
      ('EA513', 'Circuitos de primeira ordem RC e RL sem fontes', 14),
      ('EA513', 'Resposta ao degrau de circuitos de primeira ordem', 15),
      ('EA513', 'Circuitos de segunda ordem RLC sem fontes', 16),
      ('EA513', 'Resposta ao degrau de circuitos de segunda ordem', 17),
      ('EA513', 'Fontes senoidais e conceito de fasor', 18),
      ('EA513', 'Impedancia e admitancia, Kirchhoff em CA', 19),
      ('EA513', 'Analise nodal e de malhas em CA', 20),
      ('EA513', 'Teoremas de circuitos em regime permanente senoidal', 21),
      ('EA513', 'Analise de potencia em CA', 22),
      ('EA513', 'Potencias aparente e complexa, correcao do fator de potencia', 23)
    ) as t(code, nome, pos)
  loop
    select id into sid from public.subjects where user_id = uid and code = r.code;
    if sid is null then continue; end if;
    if not exists (select 1 from public.topics where user_id = uid and subject_id = sid and name = r.nome) then
      insert into public.topics (user_id, subject_id, name, position)
        values (uid, sid, r.nome, r.pos);
    else
      update public.topics set position = r.pos
        where user_id = uid and subject_id = sid and name = r.nome;
    end if;
  end loop;
end $$;
