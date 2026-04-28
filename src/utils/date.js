/**
 * Converte entradas de data para Date de forma consistente.
 * - Para strings no formato YYYY-MM-DD, usa meio-dia UTC para evitar "voltar um dia" por fuso.
 */
export function parseDateInput(value, fallback = new Date()) {
  if (!value) return fallback;
  if (typeof value === 'string' && value.length === 10) {
    const d = new Date(`${value}T12:00:00Z`);
    return isNaN(d.getTime()) ? fallback : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

