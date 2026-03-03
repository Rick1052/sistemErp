import express from 'express';

import { createController, getAllController, deleteController, getByIdController, updateController } from './supplier.controller.js';

import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { requireCompany } from '../../../middleware/require.company.js';
import { validate } from '../../../middleware/validate.middleware.js';

import { createSupplierSchema } from './supplier.schema.js'

const router = express.Router();

router.post(
    '/',
    authMiddleware,
    requireCompany,
    validate(createSupplierSchema),
    createController
)

router.get(
    '/',
    authMiddleware,
    requireCompany,
    getAllController
)

router.get(
    '/:id',
    authMiddleware,
    requireCompany,
    getByIdController
)

router.put(
    '/:id',
    authMiddleware,
    requireCompany,
    validate(createSupplierSchema),
    updateController
)

router.delete(
    '/:id',
    authMiddleware,
    requireCompany,
    deleteController
)

export default router; 