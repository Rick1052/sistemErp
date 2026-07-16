import { Router } from 'express';
import { platformBillingController } from './platformBilling.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../../middleware/require.superadmin.js';
import { requireCompany } from '../../middleware/require.company.js';
import { requireRole } from '../../middleware/require.role.js';
import { validate } from '../../middleware/validate.middleware.js';
import { cacheResponse } from '../../middleware/cache.middleware.js';
import { createSubscriptionSchema } from './platformBilling.schema.js';

const routes = Router();

// Rota pública — chamada pelo Asaas, validada pelo token da URL (sem autenticação de usuário)
routes.post('/webhook/:token', platformBillingController.webhook);

// Faturas do próprio tenant — ADMIN da empresa logada (não exige super-admin)
// Cache 120s: evita bater no Asaas (backfill de link) a cada abertura da dashboard
routes.get('/me', authMiddleware, requireCompany, requireRole('ADMIN'), cacheResponse('platform-billing', 120), platformBillingController.getMyBilling);

// Área do super-admin da plataforma
routes.use(authMiddleware, requireSuperAdmin);

routes.get('/status', platformBillingController.getStatus);
routes.get('/companies', platformBillingController.listCompanies);
routes.get('/subscriptions', platformBillingController.listSubscriptions);
routes.post('/subscriptions', validate(createSubscriptionSchema), platformBillingController.createSubscription);
routes.delete('/subscriptions/:id', platformBillingController.cancelSubscription);

export default routes;
