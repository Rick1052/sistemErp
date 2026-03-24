import { Router } from 'express';
import { userController } from './user.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireCompany } from '../../middleware/require.company.js';

const router = Router();

// Todas as rotas de usuários de empresa exigem autenticação e empresa selecionada
router.use(authMiddleware, requireCompany);

router.get('/', userController.listMembers);
router.post('/', userController.addMember);
router.put('/:id', userController.updateMember);
router.delete('/:id', userController.removeMember);

export default router;
