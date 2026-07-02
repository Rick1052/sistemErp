import { Router } from 'express';
import { nfeController } from './nfe.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { requireRole } from '../../middleware/require.role.js';
import { validate } from '../../middleware/validate.middleware.js';
import { configureCompanySchema, setAmbienteSchema, cancelNfeSchema } from './nfe.schema.js';

const routes = Router();

// Rota pública — chamada pela Focus NFe, sem autenticação de usuário (validada por assinatura própria)
routes.post('/webhook', nfeController.webhook);

routes.use(authMiddleware, requireCompany);

routes.get('/empresa', nfeController.getConfig);
routes.put('/empresa', requireRole('ADMIN'), validate(configureCompanySchema), nfeController.configureCompany);
routes.put('/empresa/ambiente', requireRole('ADMIN'), validate(setAmbienteSchema), nfeController.setAmbiente);

routes.post('/vendas/:saleId', nfeController.emit);
routes.get('/vendas/:saleId', nfeController.getStatus);
routes.post('/vendas/:saleId/cancelar', validate(cancelNfeSchema), nfeController.cancel);

export default routes;
