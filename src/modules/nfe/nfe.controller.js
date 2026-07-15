import { nfeService } from './nfe.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/logger.js';

export const nfeController = {
  getConfig: asyncHandler(async (req, res) => {
    const config = await nfeService.getConfig(req.companyId);
    return res.json(config);
  }),

  configureCompany: asyncHandler(async (req, res) => {
    const config = await nfeService.configureCompany(req.companyId, req.validatedBody);
    return res.json(config);
  }),

  setAmbiente: asyncHandler(async (req, res) => {
    const config = await nfeService.setAmbiente(req.companyId, req.validatedBody.ambiente);
    return res.json(config);
  }),

  list: asyncHandler(async (req, res) => {
    const { page, limit, status, search } = req.query;
    const result = await nfeService.list(req.companyId, {
      page: parseInt(page) > 0 ? parseInt(page) : 1,
      limit: parseInt(limit) > 0 ? parseInt(limit) : 25,
      status: status || undefined,
      search: search || undefined,
    });
    return res.json(result);
  }),

  createDraft: asyncHandler(async (req, res) => {
    const emission = await nfeService.createDraft(req.companyId, req.params.saleId);
    return res.status(201).json(emission);
  }),

  updateDraft: asyncHandler(async (req, res) => {
    const emission = await nfeService.updateDraft(req.companyId, req.params.id, req.validatedBody);
    return res.json(emission);
  }),

  getEmission: asyncHandler(async (req, res) => {
    const emission = await nfeService.getEmissionById(req.companyId, req.params.id);
    return res.json(emission);
  }),

  emit: asyncHandler(async (req, res) => {
    const emission = await nfeService.emit(req.companyId, req.params.saleId);
    return res.status(202).json(emission);
  }),

  getStatus: asyncHandler(async (req, res) => {
    const emission = await nfeService.getStatus(req.companyId, req.params.saleId);
    return res.json(emission);
  }),

  cancel: asyncHandler(async (req, res) => {
    const emission = await nfeService.cancel(req.companyId, req.params.saleId, req.validatedBody.justificativa);
    return res.json(emission);
  }),

  // Rota pública chamada pela Focus NFe — validada por segredo customizado, sem authMiddleware
  webhook: asyncHandler(async (req, res) => {
    const secret = process.env.FOCUS_NFE_WEBHOOK_SECRET;
    const received = req.headers['x-focus-signature'];

    if (secret && received !== secret) {
      logger.warn({ msg: '[nfeController] Webhook com assinatura inválida' });
      return res.status(401).json({ message: 'Assinatura inválida' });
    }

    await nfeService.handleWebhook(req.body);
    return res.status(200).json({ ok: true });
  }),
};
