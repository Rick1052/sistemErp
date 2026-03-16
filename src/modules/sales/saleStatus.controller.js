import { saleStatusService } from './saleStatus.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const saleStatusController = {
  list: asyncHandler(async (req, res) => {
    const statuses = await saleStatusService.list(req.companyId);
    res.json(statuses);
  }),

  getById: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const status = await saleStatusService.getById(req.companyId, id);
    res.json(status);
  }),

  create: asyncHandler(async (req, res) => {
    const status = await saleStatusService.create(req.companyId, req.body);
    res.status(201).json(status);
  }),

  update: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const status = await saleStatusService.update(req.companyId, id, req.body);
    res.json(status);
  }),

  delete: asyncHandler(async (req, res) => {
    const { id } = req.params;
    await saleStatusService.delete(req.companyId, id);
    res.status(204).send();
  }),

  seed: asyncHandler(async (req, res) => {
    await saleStatusService.seedDefaults(req.companyId);
    res.status(201).json({ message: 'Status padrões criados com sucesso' });
  })
};
