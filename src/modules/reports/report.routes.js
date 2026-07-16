import { Router } from 'express';
import { reportController } from './report.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { cacheResponse } from '../../middleware/cache.middleware.js';

const router = Router();

// Todos os relatórios requerem autenticação e contexto de empresa
router.use(authMiddleware, requireCompany);

// Relatórios são pesados e read-only — cache de 120s por empresa+filtros
router.use(cacheResponse('reports', 120));

router.get('/sales', reportController.getSalesReport);
router.get('/commercial-sales', reportController.getCommercialSalesReport);
router.get('/product-sales', reportController.getProductSalesReport);
router.get('/financial', reportController.getFinancialReport);
router.get('/bank-statement', reportController.getBankStatement);
router.get('/dre', reportController.getDREReport);
router.get('/cheques', reportController.getChequesReport);

export default router;
