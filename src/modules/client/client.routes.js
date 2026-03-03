import express from 'express';
import { 
    createController, 
    listController, 
    getByIdController, 
    deleteControler,
    updateController,
    deleteManyController
} from "./client.controller.js";

import { authMiddleware } from "./../../middleware/auth.middleware.js";
import { requireCompany } from '../../middleware/require.company.js';
import { validate } from '../../middleware/validate.middleware.js';

import { createClientSchema, updateClientSchema } from '../client/client.schema.js';

const router = express.Router();

router.post(
    "/", 
    authMiddleware, 
    requireCompany,
    validate(createClientSchema),
    createController
);

router.get(
    "/", 
    authMiddleware, 
    requireCompany,
    listController
);

router.get(
    "/:id", 
    authMiddleware, 
    requireCompany,
    getByIdController
);

router.put(
    "/:id",
    authMiddleware,
    requireCompany,
    validate(updateClientSchema),
    updateController
)

router.delete(
    "/:id",
    authMiddleware, 
    requireCompany,
    deleteControler
)

router.delete(
    "/",
    authMiddleware,
    requireCompany,
    deleteManyController
)

export default router