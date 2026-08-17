export const API_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export function resolveApiRateLimitMax(env = process.env) {
  const configured = Number(env.API_RATE_LIMIT_MAX);
  if (Number.isInteger(configured) && configured > 0) return configured;

  // Uma única tela do ERP consulta vários recursos em paralelo. Em desenvolvimento,
  // o React também repete alguns efeitos para detectar problemas, então 100 chamadas
  // por janela bloqueava um uso local normal.
  return env.NODE_ENV === 'production' ? 1000 : 5000;
}
