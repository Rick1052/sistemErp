import { getRedis } from './redis.js';

function stableStringify(obj) {
  // req.query já vem como objeto simples; ainda assim, ordenamos chaves.
  const keys = Object.keys(obj || {}).sort();
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

async function ensureConnected(r) {
  if (!r) return false;
  if (r.status === 'ready') return true;
  try {
    // Espera no máximo ~250ms pela conexão. Se não der tempo, a requisição segue
    // pelo fallback (banco) e a conexão continua sendo aberta em background —
    // a próxima requisição já encontra o Redis pronto. Cache nunca adiciona latência.
    await Promise.race([
      r.connect().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);
    return r.status === 'ready';
  } catch {
    return false;
  }
}

async function withRedisFallback(fallback, operation) {
  const redis = getRedis();
  if (!redis) return fallback();

  try {
    const connected = await ensureConnected(redis);
    if (!connected) return fallback();
    return await operation(redis);
  } catch {
    return fallback();
  }
}

// ---------------------------------------------------------------------------
// Camada L1 em memória (por processo). Funciona mesmo sem Redis; com Redis,
// vira o primeiro nível e o Redis o segundo (compartilhado entre instâncias).
// As chaves incluem a versão do recurso, então a invalidação por versão
// continua valendo: um bump muda a chave e a entrada antiga expira sozinha.
// ---------------------------------------------------------------------------
const MEM_MAX_ENTRIES = 500;
const memStore = new Map(); // key -> { value, expiresAt }
const memVersions = new Map(); // `${resource}:c:${companyId}` -> int

function memGet(key) {
  const entry = memStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return undefined;
  }
  return entry.value;
}

function memSet(key, value, ttlSeconds) {
  if (memStore.size >= MEM_MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, e] of memStore) {
      if (now > e.expiresAt) memStore.delete(k);
    }
    // Se ainda estiver cheio (tudo válido), descarta as entradas mais antigas
    while (memStore.size >= MEM_MAX_ENTRIES) {
      const oldest = memStore.keys().next().value;
      memStore.delete(oldest);
    }
  }
  memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheGetOrSetJSON({
  key,
  ttlSeconds = 60,
  producer,
}) {
  const memHit = memGet(key);
  if (memHit !== undefined) return memHit;

  const value = await withRedisFallback(producer, async (redis) => {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const produced = await producer();
    await redis.set(key, JSON.stringify(produced), 'EX', ttlSeconds);
    return produced;
  });

  memSet(key, value, ttlSeconds);
  return value;
}

export async function cacheGetOrSetJSONWithStatus({
  key,
  ttlSeconds = 60,
  producer,
}) {
  const memHit = memGet(key);
  if (memHit !== undefined) return { value: memHit, status: 'HIT' };

  const result = await withRedisFallback(
    async () => ({ value: await producer(), status: 'BYPASS' }),
    async (redis) => {
      const cached = await redis.get(key);
      if (cached) return { value: JSON.parse(cached), status: 'HIT' };

      const value = await producer();
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return { value, status: 'MISS' };
    }
  );

  memSet(key, result.value, ttlSeconds);
  return result;
}

/** Leitura simples (L1 → Redis). Retorna undefined em miss. */
export async function cacheGetJSON(key) {
  const memHit = memGet(key);
  if (memHit !== undefined) return memHit;

  return withRedisFallback(
    async () => undefined,
    async (redis) => {
      const cached = await redis.get(key);
      if (!cached) return undefined;
      const value = JSON.parse(cached);
      memSet(key, value, 30); // reaproveita no L1 por um curto período
      return value;
    }
  );
}

/** Escrita simples (L1 + Redis). */
export async function cacheSetJSON(key, value, ttlSeconds = 60) {
  memSet(key, value, ttlSeconds);
  await withRedisFallback(async () => undefined, async (redis) => {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  });
}

export async function cacheBumpVersion({ companyId, resource }) {
  const vkey = `${resource}:c:${companyId}`;
  memVersions.set(vkey, (memVersions.get(vkey) || 0) + 1);
  await withRedisFallback(async () => undefined, async (redis) => {
    await redis.incr(`v:${vkey}`);
  });
}

export async function cacheGetVersion({ companyId, resource }) {
  const vkey = `${resource}:c:${companyId}`;
  return withRedisFallback(
    async () => memVersions.get(vkey) || 0,
    async (redis) => {
      const v = await redis.get(`v:${vkey}`);
      return Number(v || 0);
    }
  );
}

export async function cacheKeyFromReq({
  companyId,
  resource,
  query,
}) {
  const v = await cacheGetVersion({ companyId, resource });
  return `cache:${resource}:c:${companyId}:v:${v}:q:${stableStringify(query)}`;
}
