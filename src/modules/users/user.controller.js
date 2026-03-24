import { userService } from './user.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';

export const userController = {
    listMembers: asyncHandler(async (req, res) => {
        // Apenas ADMIN pode listar equipe? 
        // O usuário disse: "opção para o admin poder cadastrar mais funcionário"
        // Geralmente listagem também é para admin
        if (req.userRole !== 'ADMIN') {
            throw new AppError('Acesso restrito a administradores', 403);
        }

        const members = await userService.listByCompany(req.companyId);
        res.json(members);
    }),

    addMember: asyncHandler(async (req, res) => {
        if (req.userRole !== 'ADMIN') {
            throw new AppError('Acesso restrito a administradores', 403);
        }

        const { name, email, role, password } = req.body;
        
        if (!email || !role) {
            throw new AppError('E-mail e Role são obrigatórios', 400);
        }

        const member = await userService.addMember(req.companyId, { name, email, role, password });
        res.status(201).json(member);
    }),

    removeMember: asyncHandler(async (req, res) => {
        if (req.userRole !== 'ADMIN') {
            throw new AppError('Acesso restrito a administradores', 403);
        }

        const { id } = req.params;
        
        if (id === req.user.id) {
            throw new AppError('Você não pode remover a si mesmo da equipe', 400);
        }

        await userService.removeMember(req.companyId, id);
        res.status(204).send();
    })
};
