import prisma from '../../database/prisma.js';
import bcrypt from 'bcrypt';
import { AppError } from '../../utils/AppError.js';

export const userService = {
    async listByCompany(companyId) {
        const relations = await prisma.userCompany.findMany({
            where: { companyId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        return relations.map(r => ({
            ...r.user,
            role: r.role
        }));
    },

    async addMember(companyId, { name, email, role, password }) {
        // 1. Verificar se o usuário já existe globalmente
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            // Se não existe, cria um novo usuário com senha padrão se não fornecida
            const hashedPassword = await bcrypt.hash(password || '123456', 10);
            user = await prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword
                }
            });
        }

        // 2. Verificar se já pertence a esta empresa
        const existingRelation = await prisma.userCompany.findUnique({
            where: {
                userId_companyId: {
                    userId: user.id,
                    companyId: companyId
                }
            }
        });

        if (existingRelation) {
            throw new AppError('Este usuário já faz parte desta empresa', 400);
        }

        // 3. Criar o vínculo
        return prisma.userCompany.create({
            data: {
                userId: user.id,
                companyId: companyId,
                role: role || 'USER'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });
    },

    async removeMember(companyId, userId) {
        // Não permitir remover a si mesmo (previve lock out accidental)
        // Isso deve ser validado no controller se necessário, ou aqui

        return prisma.userCompany.delete({
            where: {
                userId_companyId: {
                    userId,
                    companyId
                }
            }
        });
    },

    async updateMember(companyId, userId, { name, email, role, password }) {
        // 1. Atualizar dados do usuário (se fornecidos)
        const userData = {};
        if (name) userData.name = name;
        if (email) userData.email = email;
        if (password) userData.password = await bcrypt.hash(password, 10);

        if (Object.keys(userData).length > 0) {
            await prisma.user.update({
                where: { id: userId },
                data: userData
            });
        }

        // 2. Atualizar role na empresa
        if (role) {
            await prisma.userCompany.update({
                where: {
                    userId_companyId: {
                        userId,
                        companyId
                    }
                },
                data: { role }
            });
        }

        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                userCompanies: {
                    where: { companyId },
                    select: { role: true }
                }
            }
        });
    }
};
