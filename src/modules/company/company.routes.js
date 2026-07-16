import express from 'express';
import { 
  createCompanyController, 
  listCompaniesController,
  updateCompanyController
} from './company.controller.js'

import { authMiddleware } from '../../middleware/auth.middleware.js'
import { requireCompany } from '../../middleware/require.company.js'
import { cacheResponse } from '../../middleware/cache.middleware.js'

const router = express.Router()

// Rotas protegidas
router.post('/', authMiddleware, createCompanyController)
// A lista de empresas é por usuário (não por empresa) e carrega o logo (~150KB) — cache 5min por usuário
router.get('/', authMiddleware, cacheResponse('company', 300, (req) => req.user?.id), listCompaniesController)
router.put('/:id', authMiddleware, updateCompanyController)

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
