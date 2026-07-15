import { Router } from 'express';
import { nfeController } from './nfe.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { requireRole } from '../../middleware/require.role.js';
import { validate } from '../../middleware/validate.middleware.js';
import { configureCompanySchema, setAmbienteSchema, cancelNfeSchema, updateDraftSchema } from './nfe.schema.js';

const routes = Router();

// Rota pública — chamada pela Focus NFe, sem autenticação de usuário (validada por assinatura própria)
routes.post('/webhook', nfeController.webhook);

routes.use(authMiddleware, requireCompany);

routes.get('/empresa', nfeController.getConfig);
routes.put('/empresa', requireRole('ADMIN'), validate(configureCompanySchema), nfeController.configureCompany);
routes.put('/empresa/ambiente', requireRole('ADMIN'), validate(setAmbienteSchema), nfeController.setAmbiente);

routes.get('/', nfeController.list);
routes.get('/emissoes/:id', nfeController.getEmission);
routes.put('/emissoes/:id', validate(updateDraftSchema), nfeController.updateDraft);

routes.post('/vendas/:saleId/rascunho', nfeController.createDraft);
routes.post('/vendas/:saleId', nfeController.emit);
routes.get('/vendas/:saleId', nfeController.getStatus);
routes.post('/vendas/:saleId/cancelar', validate(cancelNfeSchema), nfeController.cancel);

export default routes;
