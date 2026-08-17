import express from 'express'
import { registerController, loginController, refreshController, switchCompanyController } from './auth.controller.js'
import { validate } from '../../middleware/validate.middleware.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { loginSchema, registerSchema, refreshSchema, switchCompanySchema } from './auth.schema.js'

const router = express.Router()

router.post('/register', validate(registerSchema), registerController)
router.post('/login', validate(loginSchema), loginController)
router.post('/refresh', validate(refreshSchema), refreshController)
router.post('/switch-company', authMiddleware, validate(switchCompanySchema), switchCompanyController)

export default router
