import { Router } from 'express';
import { saleController } from './sale.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createSaleSchema, updateSaleStatusSchema } from './sale.schema.js';

const routes = Router();

routes.use(authMiddleware, requireCompany);

routes.get('/', saleController.list);
routes.get('/:id', saleController.getById);
routes.post('/', validate(createSaleSchema), saleController.create);
routes.put('/:id', validate(createSaleSchema), saleController.update);
routes.delete('/:id', saleController.delete);
routes.patch('/:id/status', validate(updateSaleStatusSchema), saleController.updateStatus);

export default routes;
