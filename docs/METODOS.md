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
