import { saleService } from './sale.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const saleController = {
  list: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { page, limit } = req.query;
    const result = await saleService.list(companyId, {
      page: Number(page) || 1,
      limit: Number(limit) || 10
    });
    return res.json(result);
  }),

  getById: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id } = req.params;
    const sale = await saleService.getById(companyId, id);
    return res.json(sale);
  }),

  create: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const sale = await saleService.create(companyId, userId, req.body);
    return res.status(201).json(sale);
  }),

  update: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const sale = await saleService.update(companyId, userId, id, req.body);
    return res.json(sale);
  }),

  delete: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const result = await saleService.delete(companyId, userId, id);
    return res.json(result);
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const { statusId, installments } = req.body;
    const sale = await saleService.updateStatus(companyId, userId, id, statusId, installments);
    return res.json(sale);
  })
};
