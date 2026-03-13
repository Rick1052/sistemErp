import express from 'express';

import { authMiddleware } from "../../../middleware/auth.middleware.js";
import { requireCompany } from "../../../middleware/require.company.js";
import { validate } from "../../../middleware/validate.middleware.js";

import { createWarehouseSchema } from "./warehouse.schema.js";
import { createController, deleteController, getAllController, getByIdController, updateController } from './warehouse.controller.js';

const router = express.Router();

router.use(authMiddleware, requireCompany);

router.post(
    '/',
    validate(createWarehouseSchema),
    createController
)

router.get(
    '/',
    getAllController
)

router.get(
    '/:id',
    getByIdController
)

router.put(
    '/:id',
    validate(createWarehouseSchema),
    updateController
)

router.delete(
    '/:id',
    deleteController
)

export default router;