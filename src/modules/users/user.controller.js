import { userService } from './user.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { cacheBumpVersion, cacheGetOrSetJSON, cacheKeyFromReq } from '../../utils/cache.js';

export const userController = {
    listMembers: asyncHandler(async (req, res) => {
        // Apenas ADMIN pode listar equipe? 
        // O usuário disse: "opção para o admin poder cadastrar mais funcionário"
        // Geralmente listagem também é para admin
        if (req.userRole !== 'ADMIN') {
            throw new AppError('Acesso restrito a administradores', 403);
        }

        const key = await cacheKeyFromReq({
            companyId: req.companyId,
            resource: 'companyMembers',
            query: req.query,
        });

        const members = await cacheGetOrSetJSON({
            key,
            ttlSeconds: 60,
            producer: () => userService.listByCompany(req.companyId),
        });

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
        await cacheBumpVersion({ companyId: req.companyId, resource: 'companyMembers' });
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
        await cacheBumpVersion({ companyId: req.companyId, resource: 'companyMembers' });
        res.status(204).send();
    }),

    updateMember: asyncHandler(async (req, res) => {
        if (req.userRole !== 'ADMIN') {
            throw new AppError('Acesso restrito a administradores', 403);
        }

        const { id } = req.params;
        const { name, email, role, password } = req.body;

        const member = await userService.updateMember(req.companyId, id, { name, email, role, password });
        await cacheBumpVersion({ companyId: req.companyId, resource: 'companyMembers' });
        res.json(member);
    })
};
