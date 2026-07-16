import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { cacheResponse } from '../../middleware/cache.middleware.js';

const routes = Router();

routes.use(authMiddleware, requireCompany);
// Agregado mais acessado do sistema — cache curto (45s) evita as ~11 queries por acesso
routes.get('/summary', cacheResponse('dashboard', 45), dashboardController.getSummary);

export default routes;
