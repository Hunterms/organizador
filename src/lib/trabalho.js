// Regras do quadro de trabalho que NAO dependem de rede nem de React.
//
// Elas estao aqui, e nao dentro do componente, porque as mesmas duas decisoes
// aparecem em tres lugares: no board, na Edge Function `azure-item` (quando ele
// move o card) e no `sync-azure` (quando o cron roda de madrugada). Se cada um
// tivesse a sua copia, o cron desfaria de manha o que ele fez de tarde.

/**
 * Estados que significam "comecou", e por isso rendem linha no dia.
 *
 * Nao da pra olhar so "In Progress": Task anda To Do -> In Progress, mas
 * Product Backlog Item anda New -> Approved -> Committed. Pra ele os dois
 * querem dizer a mesma coisa.
 */
export const FAZENDO = new Set(['in progress', 'active', 'committed', 'doing']);
export const FECHADO = new Set(['done', 'closed', 'resolved', 'completed', 'removed']);

export const estaFazendo = (estado) => FAZENDO.has(String(estado || '').toLowerCase());

/**
 * A ordem das colunas do board.
 *
 * Colunas fixas no codigo recusariam metade dos cards, porque cada TIPO de work
 * item anda por estados diferentes. Entao a ordem sai da ordem que o proprio
 * Azure devolveu os estados de cada tipo, na sequencia em que os tipos
 * aparecem — que e a sequencia do fluxo de trabalho deles, nao alfabetica.
 *
 * `Removed` fica de fora: e o lixo do Azure, nao uma coluna de trabalho.
 */
export function ordenaColunas(cards) {
  const ordem = [];
  for (const c of cards) {
    for (const e of c.estados || []) if (!ordem.includes(e)) ordem.push(e);
  }
  // Card cujo estado nao veio na lista do tipo (o sync falhou em buscar, ou o
  // time criou um estado depois) ainda precisa de coluna, senao some da tela.
  for (const c of cards) if (c.coluna && !ordem.includes(c.coluna)) ordem.push(c.coluna);
  return ordem.filter((e) => e && e.toLowerCase() !== 'removed');
}
