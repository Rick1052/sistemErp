import { platformBillingService } from './platformBilling.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const platformBillingController = {
  getStatus: asyncHandler(async (req, res) => {
    return res.json(platformBillingService.getStatus());
  }),

  listCompanies: asyncHandler(async (req, res) => {
    const companies = await platformBillingService.listCompanies();
    return res.json(companies);
  }),

  listSubscriptions: asyncHandler(async (req, res) => {
    const subscriptions = await platformBillingService.listSubscriptions();
    return res.json(subscriptions);
  }),

  createSubscription: asyncHandler(async (req, res) => {
    const subscription = await platformBillingService.createSubscription(req.validatedBody);
    return res.status(201).json(subscription);
  }),

  cancelSubscription: asyncHandler(async (req, res) => {
    const subscription = await platformBillingService.cancelSubscription(req.params.id);
    return res.json(subscription);
  }),

  // Faturas do próprio tenant (ADMIN da empresa logada)
  getMyBilling: asyncHandler(async (req, res) => {
    const billing = await platformBillingService.getMyBilling(req.companyId);
    return res.json(billing);
  }),

  // Rota pública chamada pelo Asaas — validada pelo token da URL, sem authMiddleware
  webhook: asyncHandler(async (req, res) => {
    await platformBillingService.handleWebhook(req.params.token, req.body);
    return res.status(200).json({ ok: true });
  }),
};
