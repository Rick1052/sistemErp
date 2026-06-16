import { Router } from 'express';
import { reportController } from './report.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';

const router = Router();

router.use(authMiddleware, requireCompany);

router.get('/dre', reportController.getDRE);
router.get('/dre/drill-down', reportController.getDREDrillDown);

export default router;
