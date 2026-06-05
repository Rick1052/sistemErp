import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

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
      logger.warn(`Acesso negado: Usuário ${req.user.id} tentou acessar empresa ${req.companyId} sem permissão`);
      return res.status(403).json({
        message: 'Usuário não pertence a esta empresa ou empresa inválida'
      });
    }

    req.userRole = relation.role;
    next();
  } catch (error) {
    logger.error({
      msg: 'Erro ao validar empresa no Middleware',
      error: error.message,
      code: error.code,
      userId: req.user?.id,
      companyId: req.companyId
    });

    return res.status(500).json({
      message: 'Erro interno ao validar dados da empresa',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}