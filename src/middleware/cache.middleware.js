import { cacheGetJSON, cacheSetJSON, cacheKeyFromReq } from '../utils/cache.js';
import logger from '../utils/logger.js';

/**
 * Middleware de cache de resposta para rotas GET (por escopo + querystring + path).
 * - Escopo padrão: a empresa (req.companyId). Para rotas cujo resultado depende do
 *   usuário (ex.: lista de empresas do usuário), passe getScopeId = (req) => req.user?.id.
 * - Usa a versão do recurso na chave: um cacheBumpVersion({resource}) invalida tudo.
 * - Em HIT, responde direto sem tocar no controller/banco.
 * - Em MISS, intercepta o res.json e grava a resposta (somente status 2xx).
 * Deve rodar após o authMiddleware (e requireCompany, no escopo padrão).
 */
export function cacheResponse(resource, ttlSeconds = 60, getScopeId = (req) => req.companyId) {
  return async (req, res, next) => {
    try {
      const scopeId = getScopeId(req);
      if (!scopeId) return next(); // sem escopo identificável, não cacheia

      const key = await cacheKeyFromReq({
        companyId: scopeId,
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
