# Métodos de estudo do Hunter

Canon do organizador. O planejador semanal (`src/lib/weekPlan.js`) lê estas
regras. Se uma regra muda aqui, o plano muda junto.

Contexto fixo: 7 matérias, 24h de aula por semana, CLT flexível com reunião
fixa às 11h de segunda a sexta. Orçamento de estudo declarado: **2h por dia
útil, 4h no sábado e 4h no domingo = 18h por semana.**

18h para 7 matérias dá 2,5h cada. Não fecha para estudar tudo toda semana.
Por isso o plano é dirigido por prazo, não por matéria. Quem tem avaliação
perto come a fatia grande; quem não tem entra em manutenção.

---

## 1. O que a evidência derruba primeiro

Dunlosky e colegas (2013) avaliaram 10 técnicas de estudo. As três mais usadas
por estudante ficaram na nota mais baixa: **reler, grifar e resumir**. Não são
neutras, são tempo gasto que parece estudo e não vira nota.

Duas ficaram com utilidade alta:

- **Practice testing** (se testar, sem olhar a resposta)
- **Distributed practice** (espalhar no tempo em vez de amontoar)

Três ficaram com utilidade moderada e entram no plano: **self-explanation**,
**elaborative interrogation** e **interleaved practice**.

Regra prática: se um bloco de estudo termina e você não produziu nenhuma
resposta sua, sem consultar, aquele bloco não contou.

## 2. Os três tipos de matéria, e o método de cada um

As 7 matérias não são a mesma coisa. Aplicar o mesmo método nas 7 é o erro
mais caro que dá pra cometer com 18h.

### Tipo A — Resolver problema com matemática pesada
**EE400, MS211, EA513, e a metade teórica de MC404.**

O caminho é worked example → faded → sozinho.

1. **Worked example.** Novato aprende mais lendo solução resolvida passo a
   passo do que tentando resolver. Não é preguiça, é carga cognitiva: tentar
   sem esquema gasta memória de trabalho em busca, não em aprendizado.
2. **Faded worked example.** O mesmo problema com o último passo apagado. Você
   completa. Depois com os dois últimos apagados. O fading é o que transforma
   leitura em habilidade.
3. **Sozinho, embaralhado.**

E aqui entra a peça que quase ninguém usa: **interleaving**. Rohrer e Taylor
mostraram que embaralhar tipos de problema piora o desempenho durante o
treino e **dobra a nota no teste do dia seguinte**. Lista de 20 problemas do
mesmo tipo ensina você a repetir um procedimento. Lista embaralhada ensina
você a **escolher** o procedimento, que é o que a prova cobra.

Formato do bloco de 50min:
- 10min: 2 worked examples lidos com self-explanation (por que esse passo?)
- 15min: 2 faded, completando o final
- 20min: 5 problemas embaralhados de tipos diferentes, sem consulta
- 5min: conferir e anotar só o que errou

### Tipo B — Programação
**MC404 (assembly RISC-V), MC621, a parte Python de MS211, MC919.**

A pesquisa em ensino de computação é direta: **quem não consegue traçar
código não consegue explicar código, e quem não explica não escreve.** A
ordem importa.

Use **PRIMM**: Predict, Run, Investigate, Modify, Make.

1. **Predict** — leia o código e escreva o que ele vai imprimir. Antes de rodar.
2. **Run** — rode e compare com sua previsão. O erro é o aprendizado.
3. **Investigate** — trace linha a linha, desenhe a memória e os registradores.
4. **Modify** — mude uma coisa e preveja de novo.
5. **Make** — só agora escreva do zero.

**Parsons problem** para acelerar: pegue uma solução pronta, embaralhe as
linhas, remonte. Leva menos tempo que escrever do zero e ensina o mesmo. Bom
para quando sobrou pouca energia à noite.

Para MC621 especificamente o método é volume. São ao menos 10 exercícios por
semana disponíveis e a aprovação pede 60 pontos. O plano trata MC621 como
treino contínuo, não como matéria de véspera. Não tem exame, então dívida ali
não tem como ser paga depois.

### Tipo C — Projeto em grupo e entrega
**MC426 (5 atividades + projeto final), MC919 (3 trabalhos).**

Isso não é estudo, é gestão de entrega. O inimigo não é esquecer, é começar
tarde. O método é marco, não maratona:

- Toda entrega quebra em 3 marcos: entender o pedido, rascunho jogável, versão final.
- O primeiro marco vai para o dia seguinte ao enunciado sair. Sempre.
- Sessão de 50min por marco, espalhada. Nunca um bloco de 6h na véspera.
- Trabalho em grupo tem risco próprio: a parte dos outros. Marco 1 inclui
  dividir e combinar data, não só ler.

## 3. Quando revisar: a regra do intervalo

Cepeda e colegas mediram em mais de 1350 pessoas: **o intervalo ótimo até a
primeira revisão fica entre 10% e 20% do tempo que falta para a prova.**

| Falta para a prova | Primeira revisão |
|---|---|
| 7 dias | 1 dia depois |
| 30 dias | 3 a 6 dias depois |
| 90 dias | 9 a 18 dias depois |

Consequência prática que o planejador aplica: matéria com prova longe não
precisa de revisão semanal. Revisar cedo demais desperdiça a mesma hora que
faltaria em outro lugar.

## 4. Foco: o custo de trocar de assunto

Sophie Leroy nomeou **attention residue**: ao trocar de tarefa, parte da
atenção fica presa na anterior. O efeito é pior quando a tarefa anterior
ficou **inacabada** e sob pressão de tempo.

Isso importa muito no seu caso, porque seu dia é picado: aula, trabalho,
reunião das 11h, aula de novo, estudo às 22h.

Duas defesas, ambas com evidência:

- **Ritual de fechamento.** Ao acabar um bloco, escreva em uma linha qual é o
  próximo passo daquele assunto. Leroy mostrou que quem escreve o plano de
  retomada carrega menos resíduo para a tarefa seguinte.
- **Implementation intention** (Gollwitzer). Não "vou estudar EE400". E sim
  "**quando** forem 21h de terça, **então** abro a lista 3 de EE400 na mesa da
  cozinha". Gatilho, hora e lugar. Intenção sem gatilho não sobrevive ao cansaço.

O organizador já tem as duas peças: a tarefa com horário é a implementation
intention, e o campo de anotação no fim do pomodoro é o ritual de fechamento.

## 4b. Hábito, motivação e resiliência

Estas três seções entraram depois da auditoria de 30/08/2026, e cada uma
derrubou uma decisão que já estava no código.

### O horário tem que ser o mesmo

Lally e colegas acompanharam 96 pessoas por 12 semanas: a mediana até a
automaticidade foi de **66 dias**, com variação de 18 a 254. Wood e Neal
descrevem hábito como associação aprendida entre **contexto e resposta**.

A consequência é dura para um planejador: horário que muda todo dia não forma
hábito nenhum. Cada noite vira uma decisão nova, e decisão nova perde para o
cansaço. O planejador agora escolhe uma **hora âncora** por semana, a que está
livre no maior número de dias, e só desvia dela onde a aula ocupa.

Isso se soma às implementation intentions de Gollwitzer e Sheeran, cuja
meta-análise sobre 94 testes e mais de 8000 participantes achou efeito
**d = 0,65** sobre atingir a meta. O plano "quando" e "onde" vale mais que a
intenção "vou estudar".

### Recompensa tem que seguir o aprendizado, não o clique

Gamificação por pontos e medalhas é ambígua na literatura. Cognitive Evaluation
Theory, dentro da Self-Determination Theory, prevê que recompensa percebida
como controladora **derruba** motivação intrínseca. Hanus e Fox mediram queda
em motivação, satisfação e nota final num grupo com medalhas e pontos.

O que separa gamificação que ajuda de gamificação que atrapalha é **o que ela
premia**. Se o ponto vem por competência, sustenta. Se vem por obediência a uma
lista, treina caça ao ponto.

Por isso o XP foi reordenado: retrieval practice lidera, foco vem depois,
tarefa marcada vale pouco e beber água virou simbólico. Antes água valia mais
que 25 minutos de estudo, o que é exatamente o erro que a teoria prevê.

### O streak não pode ser a única medida

Autocrítica depois de falhar está ligada a **mais** procrastinação, não menos.
A literatura de autocompaixão (Neff) mostra que tratar o próprio erro com
dureza aumenta ansiedade e medo de falhar, e leva a metas de desempenho no
lugar de metas de aprendizado.

Um streak zerado depois de um mês perdido é exatamente esse gatilho. Por isso o
app passou a mostrar **dias ativos nos últimos 30** ao lado do streak: um número
que nenhum dia perdido destrói, e que só sobe quando você aparece.

### Metas: específicas e difíceis

Locke e Latham, sobre mais de 400 estudos: meta **específica e difícil** produz
desempenho maior que "faça o seu melhor". É por isso que o bloco do plano nunca
diz "estudar EE400": ele diz a matéria, o tópico, o método e a avaliação alvo
com os dias que faltam.

### Pausa serve pro ânimo, não substitui descanso

Meta-análise de Albulescu e colegas (2022), 22 estudos: micropausas de até 10
minutos aumentam vigor (d = 0,36) e reduzem fadiga (d = 0,35), mas o efeito
sobre **desempenho** não foi significativo (d = 0,16), aparecendo só em tarefas
de menor demanda cognitiva. A meta-regressão mostrou que pausa mais longa rende
mais.

Tradução honesta: a pausa de 5 minutos do pomodoro serve para você aguentar a
sessão, não para você render mais nela. Recuperar de estudo pesado precisa de
mais que 10 minutos, e o que recupera de verdade é dormir.

### Dormir depois de estudar é parte do estudo

Sono consolida memória declarativa, e o efeito é maior quando o sono vem logo
depois do aprendizado. Seus blocos de dia útil caem entre 19h e 22h, o que
coloca o estudo perto do sono por acidente feliz. Vale preservar: virar a noite
depois de estudar joga fora parte do que foi estudado.

## 4c. Matéria que não se frequenta

Nem toda aula na grade é aula que ele vai. Três casos, e o app trata cada um
diferente:

- **Frequenta** (MC426, MC404, MC919, MS211): conta falta, vira tarefa com
  lembrete de 1h antes, e o horário bloqueia o planejador.
- **Não frequenta** (EE400): não conta falta, não vira tarefa, e o horário
  **libera** para estudo. O alerta de 75% some, porque um limite que não vale
  é pior que nenhum.
- **Não frequenta, mas o horário é janela de entrega** (MC621): não conta falta,
  mas o horário vira bloco de trabalho fixo.

O caso do MC621 vale explicar. O PDD paga **2 pontos** por exercício entregue
nas primeiras 4h e **1 ponto** depois. Aprovação exige 60 pontos. Isso quer
dizer 30 problemas dentro da janela, ou 60 fora dela. Ficar fora da sexta 14–18
não custa presença: custa o dobro de trabalho no semestre.

## 4d. A casa: zona por dia, não dia de faxina

A mesma evidência que derruba a maratona de véspera derruba o sábado de
faxina. Duas razões, e a segunda é a que realmente pega:

**Ação simples automatiza mais rápido.** Lally mediu isso: beber água chega à
automaticidade bem antes de fazer 50 abdominais. Vinte minutos de um cômodo
por dia vira hábito; três horas de faxina no sábado nunca vira, porque cada
sábado é uma decisão nova.

**Tarefa que não cabe no dia envenena o resto.** O organizador conta o dia como
cumprido com 80% das tarefas feitas. "Organizar escritório" como tarefa diária
somava 15 minutos de faxina real a cada dia, e uma casa mal cuidada passava a
derrubar o streak de estudo. Isso é o oposto do que a rotina existe para fazer.
Por isso os cômodos saíram de diário e viraram zona semanal, e sobrou só a
âncora de dois minutos: a cama.

O sistema tem duas camadas:

- **Âncoras diárias**, 5 minutos cada: cama, gato, dente, garrafa, lixo. São
  curtas de propósito, porque é o que automatiza.
- **Uma zona por dia**, 20 a 30 minutos, cada cômodo uma vez por semana:
  segunda sala, terça banheiro, quarta quarto, quinta escritório, sexta
  lavanderia, sábado varanda, domingo guarda-roupa.

Sete cômodos, sete dias, nenhum dia de faxina. E o piso do streak protege: um
pomodoro de foco segura o dia mesmo com a casa por fazer.

## 4e. O inventário de tarefas, e por que tarefa pequena conta

Amabile e Kramer analisaram **12.000 registros diários de 238 pessoas em 7
empresas**. De tudo que acontece num bom dia, o que mais pesou foi
**fazer progresso** — acima de reconhecimento e de incentivo. Progresso pequeno
e frequente bate recompensa grande e rara.

É por isso que escovar o dente é uma tarefa marcável no app e não uma
desfeita. Mas ela não pode valer o mesmo que meia hora de trabalho: o XP passou
a ser **proporcional ao esforço** (5min vale 2, 30min vale 10, 60min vale 20).
Antes, com XP fixo em 10, as oito âncoras diárias rendiam 80 XP contra 60 de
dois pomodoros de estudo — a rotina pagava melhor que aprender.

### As frequências, e de onde vêm

| Tarefa | Frequência | Base |
|---|---|---|
| Trocar roupa de cama | semanal | 5.000.000 UFC/pol² após 1 semana; 11.900.000 após 4 |
| Trocar toalha | 2× por semana | bactéria dobra a cada 30 min em pano úmido |
| Peneirar a areia | diária | mínimo recomendado; caixa muito usada pede 2× ao dia |
| Lavar a caixa inteira | quinzenal | troca completa a cada 2 a 4 semanas em areia aglomerante |
| Escovar os dentes | 3× ao dia | acima do piso de 2× |
| Trocar a escova | trimestral | ADA: 3 a 4 meses, ou antes se a cerda abrir |

### Duas regras de montagem que saíram de medir, não de opinar

**Quinzenal ímpar e mensal ímpar colidem sempre.** Um ciclo de 2 semanas com
offset 1 cai em toda semana ímpar; um de 4 com offset 1 cai em 1, 5, 9 — todas
ímpares. `mercado` e `banheiro pesado` estavam no mesmo sábado por construção,
somando 205 minutos. Offset não basta: quando dois ciclos se contêm, um dos
dois muda de dia.

**Esforço declarado errado distorce o dia inteiro.** "Descer o lixo reciclável"
estava marcado como 30 minutos. Simulando 12 semanas, isso sozinho inflava a
segunda em meia hora que não existe. Âncora curta tem que estar marcada como
curta, senão o app mente sobre o tamanho do dia.

Medido em 84 dias: 75 a 90 minutos de tarefa por dia útil, dos quais cerca de
45 são âncoras de 5 minutos. O pico é 205 minutos, num sábado por mês, e 120
deles são o mercado.

## 4f. O que a auditoria de 30/08 encontrou

Revisando o app contra as próprias fontes, três regras do canon estavam
escritas e não implementadas. Vale registrar, porque o padrão se repete: a
regra é fácil de escrever e some na hora de codar.

**A repetição espaçada existia e o planejador ignorava.** As colunas
`next_review_at`, o `calculateNextReview` e a fila de revisão já estavam no
código, mas alimentados só por quem abrisse o modal de retrieval na mão. O
plano semanal nunca agendava revisão, e concluir um bloco nunca semeava a data.
Ou seja: distributed practice, a técnica de utilidade **alta** no Dunlosky,
estava fora do motor. Agora concluir um bloco agenda a revisão pela regra do
Cepeda — **15% do tempo que falta até a prova** — e revisão vencida entra no
topo da fila, antes de conteúdo novo, com método de retrieval em vez de
exposição.

**O ritual de fechamento era decorativo.** O guia de cada bloco mandava
"escreva numa linha qual é o próximo passo", e não havia campo para escrever.
Leroy mediu que quem escreve o plano de retomada carrega menos resíduo de
atenção. Agora fechar um bloco de estudo pede essa linha, e ela fica no tópico.

**A implementation intention estava pela metade, e foi fechada.** Gollwitzer
pede gatilho, hora **e lugar**, e o bloco só tinha hora. Agora todo bloco de
estudo nasce com lugar (o escritório), a aula carrega a sala de verdade em vez
de enfiá-la no título, e o treino aponta a academia ou o estúdio. O push mostra
os três juntos, que é a forma que a meta-análise mediu: **d = 0,65** sobre
atingir a meta, em 94 testes independentes.

O lugar é um só de propósito. O valor dele não está em ser o lugar certo, está
em ser **sempre o mesmo**: Wood e Neal descrevem hábito como associação entre
contexto e resposta, e contexto que muda não associa nada.

## 4g. O que a auditoria de 02/09 encontrou

A de 30/08 foi feita lendo o código contra as fontes. Esta foi feita
**simulando 12 semanas** com os dados reais do 2026s2: 7 matérias, 77 tópicos,
as datas de avaliação do seed. Simular achou o que ler não acha.

### O dia recebia 3,5 vezes o que cabe

`ensureWeekPlanTasks` roda a cada abertura do app e replaneja 7 dias a partir de
hoje. A dedupe era por data + matéria, o que impede a mesma matéria duas vezes
no dia e **não impede sete matérias diferentes no mesmo dia**. Cada abertura
punha uma matéria nova numa data futura, com chave diferente, e o dia empilhava.

Medido: **515 blocos criados contra um orçamento de 216**, 78 de 84 dias
estourados, terças de 2 blocos chegando a 7. Um dia que mente sobre o próprio
tamanho derruba os 80% do streak e envenena todo o dado que o app usa depois.
Agora existe teto por dia, derivado do mesmo orçamento que o planejador usa.

### A cobertura não se movia

`restantes` era `status !== 'mastered'`, e concluir um bloco grava `lastStudied`
e `next_review_at` sem tocar `status`. Resultado medido: MS211 com **7 de 7
tópicos estudados** e o planejador ainda vendo 7 restantes. O peso da matéria,
que é a regra 1, saía de um número que nunca caía.

Agora pendente é o que ainda pede trabalho antes da prova: tópico estudado com
revisão no futuro sai da conta, e **volta a entrar quando a revisão vence**.

### A ordem por esquecimento nunca funcionou

`escolheTopico` ordenava por `t.last_studied`. O estado do app usa
`lastStudied`, porque é isso que `fetchAllData` produz. O campo lido era sempre
`undefined`, então "o mais esquecido primeiro" caía na ordem do array.

O teste que cobria isso passava, porque a fixture foi escrita com a grafia do
código em vez da grafia do dado real. Teste escrito contra o código, e não
contra o dado, dá verde em caminho morto. Padronizado em `lastStudied`, e a
fixture agora usa a forma que o app produz.

### Auto-avaliação alta desligava a matéria

Nota 4 no retrieval carimbava `mastered`, e `mastered` tirava o tópico da conta
da prova para sempre. Um "quase tudo, falhei um detalhe" numa noite boa reduzia
os blocos daquela matéria pelo resto do semestre.

A literatura de calibração diz que esse é o pior sinal possível para essa
decisão: quem se superestima **encerra o estudo cedo e a retenção cai**, e a má
calibração é mais forte justamente em quem ainda sabe menos (Koriat 1997;
Dunlosky, Rawson, Kruger e Dunning). Agora nota alta só **espaça** a revisão,
que é reversível. `mastered` passa a exigir acerto verificado, não sensação.

### O orçamento passou a ser medido, não declarado

Buehler, Griffin e Ross: a falácia do planejamento erra para baixo e continua
errando **mesmo quando a pessoa sabe** que tarefa parecida demorou mais. O
antídoto com evidência é reference class forecasting: prever pela distribuição
do que já aconteceu.

O canon já tinha tropeçado nisso à mão, quando "descer o lixo reciclável"
estava marcado como 30 minutos e só apareceu simulando 12 semanas. Agora
`src/lib/orcamento.js` faz isso sozinho: mediana do que foi **efetivamente
fechado** por dia da semana nas últimas 4 semanas, com teto no declarado e piso
de 1 bloco. Menos de 2 observações no dia da semana, respeita o declarado.

Teto no declarado porque render 4h numa segunda não autoriza o app a marcar 4h:
a CLT e a aula existem, e isso ele sabe e o app não. Piso de 1 bloco porque
orçamento zero apaga o dia do plano, e um app que para de planejar depois de uma
semana ruim é pior que um app otimista.

### A revisão do Cepeda não cabe no orçamento, e isso não é bug

Medido: das 203 revisões que 12 semanas agendam, **21% caem no dia previsto** e
28% não chegam no período. Antes de culpar a fila, vale a conta: são 216 blocos
em 12 semanas, 77 tópicos precisando de primeira exposição, e 203 revisões
pedidas. Mesmo com escalonamento perfeito o teto é 139 de 203, ou 68%. O medido
serve 71% em algum momento.

Ou seja, o planejador já opera no limite da capacidade. O intervalo de 15% gera
mais demanda de revisão do que 18h por semana absorvem com 7 matérias e 77
tópicos. Isso não se conserta com prioridade: se conserta com mais hora, menos
tópico em jogo, ou aceitando que revisão é melhor esforço. É decisão de
orçamento, não de código.

O que foi consertado no meio disso: revisão vencida agora garante **cota**, não
só lugar na fila. Antes ela era escolhida na frente dentro dos blocos que a
matéria recebeu, e matéria com cota zero na semana não revisava nunca.

### O aviso de estudo passivo estava escrito e desligado

`flagPassiveStudy` existia desde a migração de métodos, com zero chamadas. Ela
detecta o modo de falha mais caro do Dunlosky: tempo sentado no tópico sem uma
única tentativa de recuperação, que é hora que parece estudo e não vira nota.
Agora aparece na tela de Estudos, e o toque abre o retrieval naquele tópico.

## 4h. Procrastinação, e o retorno do esforço

Estas duas entraram em 02/09/2026. Foram as únicas lacunas reais de cinco
frentes revisadas: método de estudo, procrastinação, foco, disciplina e retorno.
Método, foco e disciplina já estavam cobertos, e não vale reescrever o que a
seção 2, a 4 e a 4b já dizem.

### O app é um planejador, e procrastinação não é problema de planejamento

Esta é a descoberta desconfortável. Steel (2007), meta-análise de **691
correlações em 216 amostras**, põe quatro coisas como preditores de
procrastinação: **aversão à tarefa, atraso da recompensa, autoeficácia e
impulsividade**. Nenhuma das quatro é agenda.

Sirois e Pychyl vão além: procrastinar é **reparo de humor de curto prazo**,
regulação de emoção e não de tempo. Não se adia por não saber quando estudar.
Adia-se porque abrir a lista dói agora, e a conta é do eu de dezembro.

O organizador gastou toda a inteligência dele em escalonamento, que é
exatamente a única coisa que esse mecanismo não usa. Isso não invalida o
planejador: um plano ruim atrapalha. Só quer dizer que melhorar o plano tem
teto, e o teto já foi atingido.

### O valor esperado do bloco, não o valor do bloco

A regra 3 diz bloco de 50 minutos, nunca menos, "porque o custo de entrar no
assunto come a sessão". O argumento é bom e está incompleto: ele otimiza o
**valor** da sessão e nunca mediu a **probabilidade** de ela começar.

Valor esperado = P(começar) × valor. Um bloco de 50 que começa 40% das vezes
perde de um de 15 que começa 90%.

Por isso `src/lib/aderencia.js` mede, e o veredito foi escrito **antes** de ver
o número, para não virar interpretação conveniente depois:

| Fechados em 4 semanas | Veredito |
|---|---|
| 75% ou mais | A regra 3 está certa. Não mexer. |
| Entre 50% e 75% | Não decide. |
| Menos de 50% | A aversão está ganhando. O bloco precisa de porta menor. |

Mínimo de 10 blocos na janela; abaixo disso não opina.

E a medida separa dois modos de falha que somados esconderiam a resposta:

- **Nem abriu** (zero pomodoro): aversão ou impulsividade.
- **Abriu e parou** (pomodoro parcial): bloco grande demais, cansaço, interrupção.

A intervenção dos dois é oposta, então o número precisa dizer qual domina.

### A porta de entrada já existia, invisível

`keptDay` sempre segurou o dia com **um** pomodoro, e o botão de foco sempre
esteve no cartão da tarefa. O que faltava era isso aparecer no momento em que se
decide não começar. Agora o bloco de estudo ainda não aberto mostra uma linha
dizendo que um pomodoro só já segura o dia. É texto, não motor: a mudança mais
barata desta auditoria e a que ataca o preditor mais forte do Steel.

### O quanto isso paga, sem inflar

Meta-análise de tratamentos psicológicos para procrastinação: **g = 0,34**
[0,11–0,56], 12 estudos, 718 pessoas, e **92% dos estudos com alto risco de
viés**. O subgrupo de TCC dá g = 0,55, com 3 estudos e depois de excluir um
outlier. É modesto e a base é fraca. Fica registrado assim para ninguém
prometer conserto.

### O laço até a nota estava aberto

`grades.js` calculava a média da fórmula e nada ligava hora estudada à nota que
saiu. O app media esforço, media resultado, e nunca punha os dois na mesma tela.

Isso importa porque hábito de estudo prediz nota: Credé e Kuncel acham que
hábitos e habilidades de estudo **rivalizam com prova padronizada e nota
anterior** como preditores. Duckworth e Seligman acham autodisciplina explicando
**mais de duas vezes** a variância do QI em nota final, controlando nota
anterior e teste de aptidão. Um dos desfechos previstos por autodisciplina no
estudo deles foi literalmente a hora do dia em que o aluno começa a lição, que é
o que a hora âncora da seção 4b faz.

`src/lib/retorno.js` põe hora fechada e nota lançada lado a lado, por matéria.
Hora conta só bloco efetivamente fechado; nota usa a fórmula de aprovação da
matéria quando ela existe, porque é ela que aprova, não a média aritmética.

**O que isso não é:** correlação nem causalidade. São ~17 notas no semestre, com
7 matérias de professor e dificuldade diferentes. Não há coeficiente nenhum ali
de propósito. Serve para uma coisa que n=1 aguenta: flagrar descasamento grosso,
matéria que come hora acima da mediana e devolve média abaixo de 5. E o oposto,
matéria que rende sem comer hora, que é onde não se deve mexer.

### Dois achados bonitos que morreram na conferência

Vale registrar, porque os dois passariam se ninguém checasse.

**Prazos autoimpostos (Ariely e Wertenbroch, 2002).** Era o achado mais
acionável de todos, prazo intermediário espaçado melhorando nota, e cabia num
app como este sem esforço. O próprio Ariely publicou nota dizendo que os dados
do artigo têm **anomalias sérias**. Descartado.

**Presença do celular (Ward e colegas, 2017).** Descartado na auditoria
anterior: a replicação direta de 2022 falhou e a meta-análise de 22 estudos dá
**g = −0,14**, com atenção não significativa e efeito não significativo em
amostras europeias e norte-americanas.

**E um número que não se estica.** O d = 0,65 do Gollwitzer vale para atingir
meta, e é assim que a seção 4b o cita. A própria revisão avisa que a maioria dos
94 estudos é sobre alcançar objetivo em geral, não sobre procrastinação. Não
vale trazer esse número para esta seção.

## 4i. Rampa de carga, e a precedencia que se divide por tipo de dia

Entrou em 03/09/2026, quando o Hunter pediu carga alta agora pra ter rotina
calma depois. O calendario justificava: EE400 P1 em 6 dias cobrindo 6 topicos,
EA513 P1 e MC426 A2 em 14 dias cobrindo 12 e 6, e **nada estudado**. Sao 24
primeiras exposicoes em 14 dias, e depois de 17/09 abre um vao de duas semanas.

### O gargalo nao era hora, era a regra 5

Conteudo novo so no fim de semana limita a ~8 primeiras exposicoes por semana.
Restavam dois fins de semana ate 17/09: 16 exposicoes para 24 necessarias. E a
prova de EE400 cai numa quarta, entao ela tinha **um** fim de semana.

A manha liberada resolve: com os 5 dias uteis ligados, cada dia ganha um bloco
de conteudo novo as 8h, e passa de 8 para 13 por semana.

### A rampa tem data de fim, e isso nao e detalhe

Carga alta sem fim declarado nao e rampa, e so um orcamento maior que ele nao
vai cumprir. `study_boost_until` e obrigatoria pro boost existir. Configurado:
3h em dia util e 5h no fim de semana ate 17/09, voltando a 2h e 4h depois.

E o orcamento medido (secao 4h) segue rodando por cima: se ele nao fechar essa
carga, a mediana do que ele de fato fecha puxa o numero para baixo sozinha. A
rampa e uma aposta que o proprio app corrige.

### Nao se revisa o que nao se aprendeu

Este e o achado que mudou uma regra. Com a prova em 13 dias, o intervalo do
Cepeda da 2 dias — entao revisao vence a cada 2 dias e **come a capacidade**.
Medido na previa: EA513 recebia 14 blocos em 14 dias e cobria **7 dos 12**
topicos da prova, re-revisando os mesmos 7. Cinco topicos chegariam na prova
sem nenhuma exposicao.

A regra que dizia "revisao vencida entra no topo da fila, antes de conteudo
novo" vem do Dunlosky e continua certa: practice testing rende mais que
exposicao. Mas ela pressupoe que a cobertura existe. Ponto que nunca foi visto
esta perdido de qualquer forma, e o valor esperado de revisar pela terceira vez
e menor que o de ver pela primeira.

Entao a precedencia passou a se dividir por tipo de dia:

| Dia | Primeiro na fila |
|---|---|
| Fim de semana e manha liberada | topico **nunca visto** |
| Noite de dia util | **revisao vencida** |

Cobertura de manha, retrieval a noite. Com a divisao, a mesma previa passou de
7 para **12 de 12** topicos da EA513 cobertos antes da prova, e 6 de 6 nas
outras duas.

### Um bloco sem horario nao e um bloco

A previa com boost criou um bloco sem hora no sabado: com o terreiro das 16h as
23h sobravam cinco candidatos (9, 10, 11, 14, 15) e o orcamento pedia seis.
Bloco sem hora nao vira implementation intention nenhuma — Gollwitzer pede
gatilho, hora **e** lugar. As 8h entraram na lista de candidatos do fim de
semana, que e hora que existe pra quem acorda as 7.

## 5. As regras que o planejador obedece

1. **Prazo manda.** Peso de cada matéria = proximidade da próxima avaliação.
   Prova em 7 dias vale muito mais que prova em 60.
2. **Nenhuma matéria zera duas semanas seguidas.** Piso de 1 bloco quinzenal,
   mesmo sem prova à vista. Dívida de 6 matérias não se paga em dezembro.
3. **Bloco é de 50min.** Um pomodoro longo. Nunca fatia menor que isso para
   conteúdo novo, porque o custo de entrar no assunto come a sessão.
4. **Dia útil recebe no máximo 2 blocos, e de matérias diferentes.**
   Interleaving entre matérias, não só dentro.
5. **Conteúdo novo vai para o fim de semana.** Dia útil às 22h depois de 6h de
   CLT e 4h de aula não é hora de aprender coisa nova. É hora de recuperar:
   practice testing, Parsons, faded examples.
6. **Toda tarefa de estudo nasce com pomodoro obrigatório.** O app já sabe
   travar tarefa até o foco acontecer. Marcar como feita sem foco é mentira
   que estraga o dado.
7. **A semana é gerada no domingo** e cobre segunda a domingo seguinte.

## 6. O que fica de fora de propósito

- Reler o slide da aula. Utilidade baixa medida.
- Resumo novo de matéria que já tem resumo. Resumir é a técnica de nota baixa,
  e você já tem os guias. O valor deles está em virar pergunta, não em ser lido.
- Maratona de véspera. Funciona para passar raspando em uma matéria e cobra o
  preço nas outras seis.

---

### Fontes

- Dunlosky, Rawson, Marsh, Nathan, Willingham (2013). *Improving Students'
  Learning With Effective Learning Techniques.* Psychological Science in the
  Public Interest.
- Rohrer & Taylor (2007). *The shuffling of mathematics problems improves
  learning.* Instructional Science 35, 481-498.
- Cepeda, Vul, Rohrer, Wixted, Pashler (2008). *Spacing Effects in Learning: A
  Temporal Ridgeline of Optimal Retention.* Psychological Science.
- Sweller e a linha de cognitive load: worked-example effect e faded worked
  examples.
- Sentance & Waite. *PRIMM: Exploring pedagogical approaches for teaching
  text-based programming.*
- Ericson e colegas, sobre Parsons problems.
- Leroy (2009). *Why is it so hard to do my work? The challenge of attention
  residue when switching between work tasks.* OBHDP.
- Gollwitzer, sobre implementation intentions.
- Buehler, Griffin & Ross. *Exploring the "planning fallacy": Why people
  underestimate their task completion times.*
- Flyvbjerg, sobre reference class forecasting como antidoto de previsao
  otimista.
- Koriat (1997), sobre pistas invalidas no julgamento do proprio aprendizado.
- Steel (2007). *The nature of procrastination: A meta-analytic and theoretical
  review of quintessential self-regulatory failure.* Psychological Bulletin.
- Sirois & Pychyl (2013). *Procrastination and the Priority of Short-Term Mood
  Regulation.* Social and Personality Psychology Compass.
- Rozental e colegas, meta-analise de tratamentos psicologicos para
  procrastinacao (g = 0,34; TCC g = 0,55 com base fraca).
- Crede & Kuncel (2008). *Study Habits, Skills, and Attitudes: The Third Pillar
  Supporting Collegiate Academic Performance.*
- Duckworth & Seligman (2005). *Self-Discipline Outdoes IQ in Predicting
  Academic Performance of Adolescents.* Psychological Science.
- Rejeitados por qualidade de evidencia: Ariely & Wertenbroch (2002), prazos
  autoimpostos, por anomalia nos dados declarada pelo autor; Ward e colegas
  (2017), presenca do celular, por falha de replicacao e efeito minusculo.
- Dunlosky, Rawson, e a linha de calibracao com Kruger & Dunning: quem se
  superestima encerra o estudo cedo, e a ma calibracao e mais forte em quem
  sabe menos.
