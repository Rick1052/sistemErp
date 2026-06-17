const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function cacheKey(userId, companyId) {
  return `${userId}:${companyId}`;
}

export function getCachedCompanyAccess(userId, companyId) {
  const entry = cache.get(cacheKey(userId, companyId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey(userId, companyId));
    return null;
  }
  return entry.role;
}

export function setCachedCompanyAccess(userId, companyId, role) {
  cache.set(cacheKey(userId, companyId), {
    role,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateCompanyAccess(userId, companyId) {
  cache.delete(cacheKey(userId, companyId));
}
