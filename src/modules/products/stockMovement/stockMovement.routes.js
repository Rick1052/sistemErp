import express from 'express';

import { authMiddleware } from "../../../middleware/auth.middleware.js";
import { requireCompany } from "../../../middleware/require.company.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { createController, listController } from './stockMovement.controller.js';
import { createMovementSchema } from './stockMovement.schema.js';

const router = express.Router();

router.post(
    '/',
    authMiddleware,
    requireCompany,
    validate(createMovementSchema),
    createController
)

router.get(
    '/',
    authMiddleware,
    requireCompany,
    listController
)

export default router;