import { paymentMethodService } from './paymentMethod.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const paymentMethodController = {
  list: asyncHandler(async (req, res) => {
    const methods = await paymentMethodService.list(req.companyId);
    res.json(methods);
  }),

  getById: asyncHandler(async (req, res) => {
    const method = await paymentMethodService.getById(req.companyId, req.params.id);
    res.json(method);
  }),

  create: asyncHandler(async (req, res) => {
    const method = await paymentMethodService.create(req.companyId, req.body);
    res.status(201).json(method);
  }),

  update: asyncHandler(async (req, res) => {
    const method = await paymentMethodService.update(req.companyId, req.params.id, req.body);
    res.json(method);
  }),

  delete: asyncHandler(async (req, res) => {
    await paymentMethodService.delete(req.companyId, req.params.id);
    res.status(204).send();
  }),
};
