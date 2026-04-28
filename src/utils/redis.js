import Redis from 'ioredis';

let redis = null;

function getRedisUrl() {
  return process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL || process.env.REDIS_URI;
}

export function getRedis() {
  if (redis) return redis;

  const url = getRedisUrl();
  if (!url) return null;

  redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    // Não logar URL/senha; apenas o erro.
    console.error('[redis] error:', err?.message || err);
  });

  return redis;
}

