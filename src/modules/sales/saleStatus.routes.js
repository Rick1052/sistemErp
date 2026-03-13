import { Router } from 'express';
import { saleStatusController } from './saleStatus.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';

const router = Router();

router.use(authMiddleware, requireCompany);

router.get('/', saleStatusController.list);
router.post('/seed', saleStatusController.seed); // Endpoint helper para criar os iniciais
router.get('/:id', saleStatusController.getById);
router.post('/', saleStatusController.create);
router.put('/:id', saleStatusController.update);
router.delete('/:id', saleStatusController.delete);

export default router;
