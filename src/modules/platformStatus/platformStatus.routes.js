import { Router } from 'express';
import { platformStatusController } from './platformStatus.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../../middleware/require.superadmin.js';

const routes = Router();

routes.use(authMiddleware, requireSuperAdmin);

routes.get('/status', platformStatusController.getStatus);

export default routes;
