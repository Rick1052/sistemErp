import { saleStatusService } from './saleStatus.service.js';

export const saleStatusController = {
  async list(req, res, next) {
    try {
      const { companyId } = req.user;
      const statuses = await saleStatusService.list(companyId);
      res.json(statuses);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const { companyId } = req.user;
      const { id } = req.params;
      const status = await saleStatusService.getById(companyId, id);
      res.json(status);
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const { companyId } = req.user;
      const status = await saleStatusService.create(companyId, req.body);
      res.status(201).json(status);
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const { companyId } = req.user;
      const { id } = req.params;
      const status = await saleStatusService.update(companyId, id, req.body);
      res.json(status);
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const { companyId } = req.user;
      const { id } = req.params;
      await saleStatusService.delete(companyId, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async seed(req, res, next) {
    try {
      const { companyId } = req.user;
      await saleStatusService.seedDefaults(companyId);
      res.status(201).json({ message: 'Status padrões criados com sucesso' });
    } catch (error) {
      next(error);
    }
  }
};
