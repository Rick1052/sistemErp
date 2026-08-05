import { Router } from 'express';
import { clientCreditController } from './clientCredit.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';
import { validate } from '../../middleware/validate.middleware.js';
import { useCreditSchema, adjustCreditSchema } from './clientCredit.schema.js';

const router = Router();

router.use(authMiddleware, requireCompany);

// Histórico (Regra 6) — aceita ?clientId=&saleId=&type=&startDate=&endDate=&page=&limit=
router.get('/', clientCreditController.history);

// Saldo do cliente (Regra 2)
router.get('/balance/:clientId', clientCreditController.balance);

// Utilização avulsa e ajuste manual
router.post('/use', validate(useCreditSchema), clientCreditController.use);
router.post('/adjust', validate(adjustCreditSchema), clientCreditController.adjust);

export default router;
