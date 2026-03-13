import { saleService } from './sale.service.js';

export const saleController = {
  async list(req, res) {
    const { companyId } = req;
    const { page, limit } = req.query;
    const result = await saleService.list(companyId, { 
      page: Number(page) || 1, 
      limit: Number(limit) || 10 
    });
    return res.json(result);
  },

  async getById(req, res) {
    const { companyId } = req;
    const { id } = req.params;
    const sale = await saleService.getById(companyId, id);
    return res.json(sale);
  },

  async create(req, res) {
    const { companyId } = req;
    const { id: userId } = req.user;
    const sale = await saleService.create(companyId, userId, req.body);
    return res.status(201).json(sale);
  },

  async update(req, res, next) {
    try {
      const { companyId } = req;
      const { id: userId } = req.user;
      const { id } = req.params;
      const sale = await saleService.update(companyId, userId, id, req.body);
      return res.json(sale);
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const { companyId } = req;
      const { id: userId } = req.user;
      const { id } = req.params;
      const result = await saleService.delete(companyId, userId, id);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const { companyId } = req;
      const { id: userId } = req.user;
      const { id } = req.params;
      const { statusId, installments } = req.body;
      const sale = await saleService.updateStatus(companyId, userId, id, statusId, installments);
      return res.json(sale);
    } catch (error) {
      next(error);
    }
  }
};
