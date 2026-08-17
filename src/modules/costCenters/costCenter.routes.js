import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { validate } from '../../middleware/validate.middleware.js';
import { costCenterController } from './costCenter.controller.js';
import {
  createCostCenterSchema,
  updateCostCenterSchema,
  updateCostCenterStatusSchema,
} from './costCenter.schema.js';

const router = Router();
router.use(authMiddleware, requireCompany);

router.get('/', costCenterController.list);
router.get('/:id', costCenterController.getById);
router.post('/', validate(createCostCenterSchema), costCenterController.create);
router.put('/:id', validate(updateCostCenterSchema), costCenterController.update);
router.patch('/:id', validate(updateCostCenterSchema), costCenterController.update);
router.patch('/:id/status', validate(updateCostCenterStatusSchema), costCenterController.updateStatus);

// Exclusão física não é exposta: centros vinculados permanecem preservados e só podem ser inativados.
export default router;

