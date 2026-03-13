import { Router } from 'express';
import { createController, listController, getByIdController, updateController, deleteController } from './fiscal.controller.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { requireCompany } from '../../../middleware/require.company.js';
import { createFiscalSchema, updateFiscalSchema } from './fiscal.schema.js';

const router = Router();

router.use(authMiddleware);
router.use(requireCompany);

router.post('/', validate(createFiscalSchema), createController);
router.get('/', listController);
router.get('/:id', getByIdController);
router.put('/:id', validate(updateFiscalSchema), updateController);
router.delete('/:id', deleteController);

export default router;
