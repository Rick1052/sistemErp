import express from 'express';

import { authMiddleware } from "../../../middleware/auth.middleware.js";
import { requireCompany } from "../../../middleware/require.company.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { createController, getByProductIdController, updateController } from './pdTax.controller.js';
import { createProductTaxSchema, updateProductTaxSchema } from './pdTax.schema.js';

const router = express.Router();

router.post(
    '/',
    authMiddleware,
    requireCompany,
    validate(createProductTaxSchema),
    createController
)

router.get(
    '/:productId',
    authMiddleware,
    requireCompany,
    getByProductIdController
)

router.put(
    '/:productId',
    authMiddleware,
    requireCompany,
    validate(updateProductTaxSchema),
    updateController
)

export default router;