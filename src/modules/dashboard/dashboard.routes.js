import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';

const routes = Router();

routes.use(authMiddleware, requireCompany);
routes.get('/summary', dashboardController.getSummary);

export default routes;
