import { getRedis } from './redis.js';

function stableStringify(obj) {
  // req.query já vem como objeto simples; ainda assim, ordenamos chaves.
  const keys = Object.keys(obj || {}).sort();
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

async function ensureConnected(r) {
  if (!r) return;
  if (r.status === 'ready') return;
  // ioredis conecta sob demanda, mas garantimos para reduzir latência no primeiro hit
  await r.connect().catch(() => {});
}

export async function cacheGetOrSetJSON({
  key,
  ttlSeconds = 60,
  producer,
}) {
  const redis = getRedis();
  if (!redis) return producer();

  await ensureConnected(redis);

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const value = await producer();
  // Cachea apenas respostas serializáveis
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  return value;
}

export async function cacheGetOrSetJSONWithStatus({
  key,
  ttlSeconds = 60,
  producer,
}) {
  const redis = getRedis();
  if (!redis) {
    const value = await producer();
    return { value, status: 'BYPASS' };
  }

  await ensureConnected(redis);

  const cached = await redis.get(key);
  if (cached) return { value: JSON.parse(cached), status: 'HIT' };

  const value = await producer();
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  return { value, status: 'MISS' };
}

export async function cacheBumpVersion({ companyId, resource }) {
  const redis = getRedis();
  if (!redis) return;
  await ensureConnected(redis);
  await redis.incr(`v:${resource}:c:${companyId}`);
}

export async function cacheGetVersion({ companyId, resource }) {
  const redis = getRedis();
  if (!redis) return 0;
  await ensureConnected(redis);
  const v = await redis.get(`v:${resource}:c:${companyId}`);
  return Number(v || 0);
}

export async function cacheKeyFromReq({
  companyId,
  resource,
  query,
}) {
  const v = await cacheGetVersion({ companyId, resource });
  return `cache:${resource}:c:${companyId}:v:${v}:q:${stableStringify(query)}`;
}

