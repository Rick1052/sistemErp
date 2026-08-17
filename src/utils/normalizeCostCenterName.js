/**
 * Chave determinística para unicidade por empresa.
 * Ignora caixa, acentos, espaços externos e sequências de espaços internas.
 */
export function normalizeCostCenterName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

