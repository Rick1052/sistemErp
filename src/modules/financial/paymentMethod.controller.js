import { paymentMethodService } from './paymentMethod.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { cacheBumpVersion, cacheGetOrSetJSON, cacheKeyFromReq } from '../../utils/cache.js';

export const paymentMethodController = {
  list: asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
      companyId: req.companyId,
      resource: 'paymentMethods',
      query: req.query,
    });

    const methods = await cacheGetOrSetJSON({
      key,
      ttlSeconds: 3600,
      producer: () => paymentMethodService.list(req.companyId),
    });

    res.json(methods);
  }),

  getById: asyncHandler(async (req, res) => {
    const method = await paymentMethodService.getById(req.companyId, req.params.id);
    res.json(method);
  }),

  create: asyncHandler(async (req, res) => {
    const method = await paymentMethodService.create(req.companyId, req.body);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'paymentMethods' });
    res.status(201).json(method);
  }),

  update: asyncHandler(async (req, res) => {
    const method = await paymentMethodService.update(req.companyId, req.params.id, req.body);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'paymentMethods' });
    res.json(method);
  }),

  delete: asyncHandler(async (req, res) => {
    await paymentMethodService.delete(req.companyId, req.params.id);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'paymentMethods' });
    res.status(204).send();
  }),
};
