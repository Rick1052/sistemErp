import { Router } from 'express';
import { platformBillingController } from './platformBilling.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../../middleware/require.superadmin.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createSubscriptionSchema } from './platformBilling.schema.js';

const routes = Router();

// Rota pública — chamada pelo Asaas, validada pelo token da URL (sem autenticação de usuário)
routes.post('/webhook/:token', platformBillingController.webhook);

// Área do super-admin da plataforma
routes.use(authMiddleware, requireSuperAdmin);

routes.get('/status', platformBillingController.getStatus);
routes.get('/companies', platformBillingController.listCompanies);
routes.get('/subscriptions', platformBillingController.listSubscriptions);
routes.post('/subscriptions', validate(createSubscriptionSchema), platformBillingController.createSubscription);
routes.delete('/subscriptions/:id', platformBillingController.cancelSubscription);

export default routes;
