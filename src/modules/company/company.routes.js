import express from 'express';
import { 
  createCompanyController, 
  listCompaniesController 
} from './company.controller.js'

import { authMiddleware } from '../../middleware/auth.middleware.js'
import { requireCompany } from '../../middleware/require.company.js'

const router = express.Router()

// Rotas protegidas
router.post('/', authMiddleware, createCompanyController)
router.get('/', authMiddleware, listCompaniesController)

router.get(
  '/me',
  authMiddleware,
  requireCompany,
  (req, res) => {
    res.json({
      message: 'Empresa validada com sucesso',
      userId: req.user.id,
      companyId: req.companyId,
      role: req.userRole
    })
  }
)


export default router
