import { cacheGetJSON, cacheSetJSON, cacheKeyFromReq } from '../utils/cache.js';
import logger from '../utils/logger.js';

/**
 * Middleware de cache de resposta para rotas GET (por empresa + querystring + path).
 * - Usa a versão do recurso na chave: um cacheBumpVersion({resource}) invalida tudo.
 * - Em HIT, responde direto sem tocar no controller/banco.
 * - Em MISS, intercepta o res.json e grava a resposta (somente status 2xx).
 * Deve rodar após authMiddleware + requireCompany (precisa de req.companyId).
 */
export function cacheResponse(resource, ttlSeconds = 60) {
  return async (req, res, next) => {
    try {
      const key = await cacheKeyFromReq({
        companyId: req.companyId,
        resource,
        query: { ...req.query, __path: req.path },
      });

      const cached = await cacheGetJSON(key);
      if (cached !== undefined) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheSetJSON(key, body, ttlSeconds).catch((err) =>
            logger.warn({ msg: '[cache] Falha ao gravar resposta', key, error: err.message })
          );
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };

      return next();
    } catch (error) {
      // Cache nunca derruba a requisição — segue sem cache
      logger.warn({ msg: '[cache] Middleware ignorado por erro', error: error.message });
      return next();
    }
  };
}
