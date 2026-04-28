import { saleStatusService } from './saleStatus.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { cacheBumpVersion, cacheGetOrSetJSON, cacheKeyFromReq } from '../../utils/cache.js';

export const saleStatusController = {
  list: asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
      companyId: req.companyId,
      resource: 'saleStatuses',
      query: req.query,
    });

    const statuses = await cacheGetOrSetJSON({
      key,
      ttlSeconds: 3600,
      producer: () => saleStatusService.list(req.companyId),
    });

    res.json(statuses);
  }),

  getById: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const status = await saleStatusService.getById(req.companyId, id);
    res.json(status);
  }),

  create: asyncHandler(async (req, res) => {
    const status = await saleStatusService.create(req.companyId, req.body);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'saleStatuses' });
    res.status(201).json(status);
  }),

  update: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const status = await saleStatusService.update(req.companyId, id, req.body);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'saleStatuses' });
    res.json(status);
  }),

  delete: asyncHandler(async (req, res) => {
    const { id } = req.params;
    await saleStatusService.delete(req.companyId, id);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'saleStatuses' });
    res.status(204).send();
  }),

  seed: asyncHandler(async (req, res) => {
    await saleStatusService.seedDefaults(req.companyId);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'saleStatuses' });
    res.status(201).json({ message: 'Status padrões criados com sucesso' });
  })
};
