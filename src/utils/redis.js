import Redis from 'ioredis';

let redis = null;
let redisDisabled = false;

function getRedisUrl() {
  return process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL || process.env.REDIS_URI;
}

function isRedisAvailable() {
  const url = getRedisUrl();
  if (!url) return false;

  // URL interna do Railway só funciona dentro da rede deles
  if (url.includes('railway.internal') && !process.env.RAILWAY_ENVIRONMENT) {
    return false;
  }

  return true;
}

export function getRedis() {
  if (redisDisabled) return null;
  if (redis) return redis;

  if (!isRedisAvailable()) return null;

  const url = getRedisUrl();

  redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    console.error('[redis] error:', err?.message || err);
    redisDisabled = true;
  });

  return redis;
}

