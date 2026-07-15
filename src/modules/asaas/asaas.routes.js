import { Router } from 'express';
import { asaasController } from './asaas.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { requireRole } from '../../middleware/require.role.js';
import { validate } from '../../middleware/validate.middleware.js';
import { configureSchema, setEnvironmentSchema, createSubscriptionSchema } from './asaas.schema.js';

const routes = Router();

// Rota pública — chamada pelo Asaas, validada pelo token da URL (sem autenticação de usuário)
routes.post('/webhook/:token', asaasController.webhook);

routes.use(authMiddleware, requireCompany);

routes.get('/config', asaasController.getConfig);
routes.put('/config', requireRole('ADMIN'), validate(configureSchema), asaasController.configure);
routes.put('/config/environment', requireRole('ADMIN'), validate(setEnvironmentSchema), asaasController.setEnvironment);

routes.get('/subscriptions', asaasController.listSubscriptions);
routes.post('/subscriptions', validate(createSubscriptionSchema), asaasController.createSubscription);
routes.get('/subscriptions/:id', asaasController.getSubscription);
routes.delete('/subscriptions/:id', asaasController.cancelSubscription);

export default routes;
