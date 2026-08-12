/**
 * Data "pura" (sem hora) que chegou já convertida por outra camada — z.coerce.date()
 * sobre "YYYY-MM-DD" produz 00:00 UTC, que no fuso do Brasil é o DIA ANTERIOR.
 * Reancoramos no meio-dia UTC, mesmo critério do ramo de string em parseDateInput.
 * Um timestamp real cair exatamente em 00:00:00.000Z é raro o bastante para não
 * justificar um campo de controle.
 */
function reanchorUtcMidnight(d) {
  const isUtcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  return isUtcMidnight ? new Date(d.getTime() + 12 * 60 * 60 * 1000) : d;
}

/**
 * Converte entradas de data para Date de forma consistente.
 * - Para strings no formato YYYY-MM-DD, usa meio-dia UTC para evitar "voltar um dia" por fuso.
 * - Para Date/ISO já em 00:00 UTC, reancora no meio-dia pelo mesmo motivo.
 */
export function parseDateInput(value, fallback = new Date()) {
  if (!value) return fallback;
  if (typeof value === 'string' && value.length === 10) {
    const d = new Date(`${value}T12:00:00Z`);
    return isNaN(d.getTime()) ? fallback : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : reanchorUtcMidnight(d);
}

