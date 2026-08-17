import { asyncHandler } from '../../utils/asyncHandler.js';
import { cacheBumpVersion } from '../../utils/cache.js';
import { costCenterService } from './costCenter.service.js';

async function invalidateCostCenterCaches(companyId) {
  await cacheBumpVersion({ companyId, resource: 'costCenters' });
  await cacheBumpVersion({ companyId, resource: 'financialRecords' });
  await cacheBumpVersion({ companyId, resource: 'financialCategories' });
  await cacheBumpVersion({ companyId, resource: 'financialCategoriesTree' });
  await cacheBumpVersion({ companyId, resource: 'sales' });
  await cacheBumpVersion({ companyId, resource: 'budgets' });
  await cacheBumpVersion({ companyId, resource: 'reports' });
}

export const costCenterController = {
  list: asyncHandler(async (req, res) => {
    res.json(await costCenterService.list(req.companyId, req.query));
  }),

  getById: asyncHandler(async (req, res) => {
    res.json(await costCenterService.getById(req.companyId, req.params.id));
  }),

  create: asyncHandler(async (req, res) => {
    const costCenter = await costCenterService.create(req.companyId, req.validatedBody);
    await invalidateCostCenterCaches(req.companyId);
    res.status(201).json(costCenter);
  }),

  update: asyncHandler(async (req, res) => {
    const costCenter = await costCenterService.update(req.companyId, req.params.id, req.validatedBody);
    await invalidateCostCenterCaches(req.companyId);
    res.json(costCenter);
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const costCenter = await costCenterService.updateStatus(
      req.companyId,
      req.params.id,
      req.validatedBody.status,
    );
    await invalidateCostCenterCaches(req.companyId);
    res.json(costCenter);
  }),
};
