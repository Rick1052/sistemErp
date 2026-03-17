import express from 'express'
import { registerController, loginController, refreshController } from './auth.controller.js'
import { validate } from '../../middleware/validate.middleware.js'
import { loginSchema, registerSchema, refreshSchema } from './auth.schema.js'

const router = express.Router()

router.post('/register', validate(registerSchema), registerController)
router.post('/login', validate(loginSchema), loginController)
router.post('/refresh', validate(refreshSchema), refreshController)

export default router
