import { financialCategoryService } from './financialCategory.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const financialCategoryController = {
  list: asyncHandler(async (req, res) => {
    const categories = await financialCategoryService.list(req.companyId);
    res.json(categories);
  }),

  getById: asyncHandler(async (req, res) => {
    const category = await financialCategoryService.getById(req.companyId, req.params.id);
    res.json(category);
  }),

  create: asyncHandler(async (req, res) => {
    const category = await financialCategoryService.create(req.companyId, req.body);
    res.status(201).json(category);
  }),

  update: asyncHandler(async (req, res) => {
    const category = await financialCategoryService.update(req.companyId, req.params.id, req.body);
    res.json(category);
  }),

  delete: asyncHandler(async (req, res) => {
    await financialCategoryService.delete(req.companyId, req.params.id);
    res.status(204).send();
  }),
};
