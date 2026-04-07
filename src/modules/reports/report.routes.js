import { Router } from 'express';
import { reportController } from './report.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';

const router = Router();

// Todos os relatórios requerem autenticação e contexto de empresa
router.use(authMiddleware, requireCompany);

router.get('/sales', reportController.getSalesReport);
router.get('/financial', reportController.getFinancialReport);
router.get('/bank-statement', reportController.getBankStatement);
router.get('/dre', reportController.getDREReport);
router.get('/cheques', reportController.getChequesReport);

export default router;
