import { Router } from 'express';
import { bankAccountController } from './bankAccount.controller.js';
import { financialRecordController } from './financialRecord.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';

const router = Router();

router.use(authMiddleware, requireCompany);

// Contas Bancárias
router.get('/accounts', bankAccountController.list);
router.get('/accounts/:id', bankAccountController.getById);
router.get('/accounts/:id/statement', bankAccountController.getStatement);
router.post('/accounts', bankAccountController.create);
router.put('/accounts/:id', bankAccountController.update);
router.delete('/accounts/:id', bankAccountController.delete);

// Formas de Pagamento
import { paymentMethodController } from './paymentMethod.controller.js';
router.get('/payment-methods', paymentMethodController.list);
router.get('/payment-methods/:id', paymentMethodController.getById);
router.post('/payment-methods', paymentMethodController.create);
router.put('/payment-methods/:id', paymentMethodController.update);
router.delete('/payment-methods/:id', paymentMethodController.delete);

// Categorias Financeiras
import { financialCategoryController } from './financialCategory.controller.js';
router.get('/categories', financialCategoryController.list);
router.get('/categories/:id', financialCategoryController.getById);
router.post('/categories', financialCategoryController.create);
router.put('/categories/:id', financialCategoryController.update);
router.delete('/categories/:id', financialCategoryController.delete);

// Títulos (Pagar/Receber)
router.get('/records', financialRecordController.list);
router.get('/records/:id', financialRecordController.getById);
router.post('/records', financialRecordController.create);
router.put('/records/:id', financialRecordController.update);
router.patch('/records/:id/pay', financialRecordController.pay);
router.patch('/records/:id/cancel', financialRecordController.cancel);
router.delete('/records/:id', financialRecordController.delete);

export default router;
