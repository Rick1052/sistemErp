import { Router } from 'express';
import { reportController } from './report.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { cacheResponse } from '../../middleware/cache.middleware.js';

const router = Router();

router.use(authMiddleware, requireCompany);

// DRE é read-only e caro — cache de 120s por empresa+filtros
router.use(cacheResponse('reports', 120));

router.get('/dre', reportController.getDRE);
router.get('/dre/drill-down', reportController.getDREDrillDown);

export default router;
