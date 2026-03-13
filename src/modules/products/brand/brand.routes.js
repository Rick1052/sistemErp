import express from 'express';

import { authMiddleware } from "../../../middleware/auth.middleware.js";
import { requireCompany } from "../../../middleware/require.company.js";
import { validate } from "../../../middleware/validate.middleware.js";

import { createBrandSchema, updateBrandSchema } from "./brand.schema.js";
import { createController, deleteController, getAllController, getByIdController, updateController } from './brand.controller.js';

const router = express.Router();

router.use(authMiddleware, requireCompany);

router.post(
    '/',
    validate(createBrandSchema),
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
    validate(updateBrandSchema),
    updateController
)

router.delete(
    '/:id',
    deleteController
)

export default router;