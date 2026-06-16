import { Router } from 'express';
import { budgetController } from './budget.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createBudgetSchema,
  updateBudgetSchema,
  updateBudgetStatusSchema,
} from './budget.schema.js';

const routes = Router();

routes.use(authMiddleware, requireCompany);

routes.get('/dashboard', budgetController.getDashboard);
routes.get('/', budgetController.list);
routes.get('/:id', budgetController.getById);
routes.post('/', validate(createBudgetSchema), budgetController.create);
routes.put('/:id', validate(updateBudgetSchema), budgetController.update);
routes.patch('/:id/status', validate(updateBudgetStatusSchema), budgetController.updateStatus);
routes.post('/:id/convert-to-sale', budgetController.convertToSale);
routes.delete('/:id', budgetController.delete);

export default routes;
