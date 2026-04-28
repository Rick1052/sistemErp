import { financialCategoryService } from './financialCategory.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { cacheBumpVersion, cacheGetOrSetJSON, cacheKeyFromReq } from '../../utils/cache.js';

export const financialCategoryController = {
  list: asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
      companyId: req.companyId,
      resource: 'financialCategories',
      query: req.query,
    });

    const categories = await cacheGetOrSetJSON({
      key,
      ttlSeconds: 3600,
      producer: () => financialCategoryService.list(req.companyId),
    });

    res.json(categories);
  }),

  getTree: asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
      companyId: req.companyId,
      resource: 'financialCategoriesTree',
      query: req.query,
    });

    const tree = await cacheGetOrSetJSON({
      key,
      ttlSeconds: 3600,
      producer: () => financialCategoryService.getTree(req.companyId),
    });

    res.json(tree);
  }),

  getById: asyncHandler(async (req, res) => {
    const category = await financialCategoryService.getById(req.companyId, req.params.id);
    res.json(category);
  }),

  create: asyncHandler(async (req, res) => {
    const category = await financialCategoryService.create(req.companyId, req.body);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialCategories' });
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialCategoriesTree' });
    res.status(201).json(category);
  }),

  update: asyncHandler(async (req, res) => {
    const category = await financialCategoryService.update(req.companyId, req.params.id, req.body);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialCategories' });
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialCategoriesTree' });
    res.json(category);
  }),

  delete: asyncHandler(async (req, res) => {
    await financialCategoryService.delete(req.companyId, req.params.id);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialCategories' });
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialCategoriesTree' });
    res.status(204).send();
  }),
};
