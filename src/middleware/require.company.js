import prisma from '../database/prisma.js';

export async function requireCompany(req, res, next) {
  if (!req.companyId) {
    return res.status(403).json({
      message: 'Empresa não selecionada'
    });
  }

  try {
    const relation = await prisma.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId: req.user.id,
          companyId: req.companyId
        }
      }
    });

    if (!relation) {
      return res.status(403).json({
        message: 'Usuário não pertence a esta empresa'
      });
    }

    req.userRole = relation.role;

    next();
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao validar empresa',
      error: error.message
    });
  }
}