import express from 'express';

import { createController, getByIdController, listController, deleteController, updateController } from "./category.controller.js";

import { authMiddleware } from "../../../middleware/auth.middleware.js";
import { requireCompany } from "../../../middleware/require.company.js";
import { validate } from "../../../middleware/validate.middleware.js";

import { createCategorySchema, updateCategorySchema } from "./category.schema.js";

const router = express.Router();

router.use(authMiddleware, requireCompany);

router.post(
    '/',
    validate(createCategorySchema),
    createController
)

router.get(
    '/',
    listController
)

router.get(
    '/:id',
    getByIdController
)

router.put(
    '/:id',
    validate(updateCategorySchema),
    updateController
)

router.delete(
    '/:id',
    deleteController
)

export default router;