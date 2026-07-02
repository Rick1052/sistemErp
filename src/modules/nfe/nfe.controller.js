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
