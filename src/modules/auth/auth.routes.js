import express from 'express'
import { registerController, loginController, refreshController } from './auth.controller.js'

const router = express.Router()

router.post('/register', registerController)
router.post('/login', loginController)
router.post('/refresh', refreshController)

export default router
