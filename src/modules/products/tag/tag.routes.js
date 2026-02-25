import express from 'express';

import { authMiddleware } from "../../../middleware/auth.middleware.js";
import { requireCompany } from "../../../middleware/require.company.js";
import { validate } from "../../../middleware/validate.middleware.js";

import { createTagSchema } from "./tag.schema.js";
import { createController, deleteController, getAllController, getByIdController, updateController } from './tag.controller.js';

const router = express.Router();

router.post(
    '/',
    authMiddleware,
    requireCompany,
    validate(createTagSchema),
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
    validate(createTagSchema),
    updateController
)

router.delete(
    '/:id',
    authMiddleware,
    requireCompany,
    deleteController
)

export default router;