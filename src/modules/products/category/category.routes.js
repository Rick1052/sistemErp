import express from 'express';

import { createController, getByIdController, listController, deleteController, updateController } from "./category.controller.js";

import { authMiddleware } from "../../../middleware/auth.middleware.js";
import { requireCompany } from "../../../middleware/require.company.js";
import { validate } from "../../../middleware/validate.middleware.js";

import { createCategorySchema, updateCategorySchema } from "./category.schema.js";

const router = express.Router();

router.post(
    '/',
    authMiddleware,
    requireCompany,
    validate(createCategorySchema),
    createController
)

router.get(
    '/',
    authMiddleware,
    requireCompany,
    listController
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
    validate(updateCategorySchema),
    updateController
)

router.delete(
    '/:id',
    authMiddleware,
    requireCompany,
    deleteController
)

export default router;