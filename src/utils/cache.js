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
    await r.connect();
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

export async function cacheGetOrSetJSON({
  key,
  ttlSeconds = 60,
  producer,
}) {
  return withRedisFallback(producer, async (redis) => {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const value = await producer();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return value;
  });
}

export async function cacheGetOrSetJSONWithStatus({
  key,
  ttlSeconds = 60,
  producer,
}) {
  return withRedisFallback(
    async () => ({ value: await producer(), status: 'BYPASS' }),
    async (redis) => {
      const cached = await redis.get(key);
      if (cached) return { value: JSON.parse(cached), status: 'HIT' };

      const value = await producer();
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return { value, status: 'MISS' };
    }
  );
}

export async function cacheBumpVersion({ companyId, resource }) {
  await withRedisFallback(async () => undefined, async (redis) => {
    await redis.incr(`v:${resource}:c:${companyId}`);
  });
}

export async function cacheGetVersion({ companyId, resource }) {
  return withRedisFallback(
    async () => 0,
    async (redis) => {
      const v = await redis.get(`v:${resource}:c:${companyId}`);
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

