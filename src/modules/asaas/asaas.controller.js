import { asaasService } from './asaas.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const asaasController = {
  getConfig: asyncHandler(async (req, res) => {
    const config = await asaasService.getConfig(req.companyId);
    return res.json(config);
  }),

  configure: asyncHandler(async (req, res) => {
    const config = await asaasService.configure(req.companyId, req.validatedBody);
    return res.json(config);
  }),

  setEnvironment: asyncHandler(async (req, res) => {
    const config = await asaasService.setEnvironment(req.companyId, req.validatedBody.environment);
    return res.json(config);
  }),

  listSubscriptions: asyncHandler(async (req, res) => {
    const subscriptions = await asaasService.listSubscriptions(req.companyId);
    return res.json(subscriptions);
  }),

  createSubscription: asyncHandler(async (req, res) => {
    const subscription = await asaasService.createSubscription(req.companyId, req.validatedBody);
    return res.status(201).json(subscription);
  }),

  getSubscription: asyncHandler(async (req, res) => {
    const subscription = await asaasService.getSubscription(req.companyId, req.params.id);
    return res.json(subscription);
  }),

  cancelSubscription: asyncHandler(async (req, res) => {
    const subscription = await asaasService.cancelSubscription(req.companyId, req.params.id);
    return res.json(subscription);
  }),

  // Rota pública chamada pelo Asaas — validada pelo token da URL, sem authMiddleware
  webhook: asyncHandler(async (req, res) => {
    await asaasService.handleWebhook(req.params.token, req.body);
    return res.status(200).json({ ok: true });
  }),
};
