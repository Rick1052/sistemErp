import prisma from '../../database/prisma.js'
import { AppError } from '../../utils/AppError.js';

// Criar empresa
export async function createCompanyService(userId, name) {
  // 400: Validação de entrada
  if (!name || name.trim().length < 3) {
    throw new AppError("O nome da empresa deve ter pelo menos 3 caracteres", 400);
  }

  // Usamos uma transação para garantir que a leitura do último COD e a criação sejam consistentes
  return prisma.$transaction(async (tx) => {
    const lastCompany = await tx.company.findFirst({
      orderBy: { cod: 'desc' },
      select: { cod: true }
    });

    const nextCod = lastCompany && lastCompany.cod ? lastCompany.cod + 1 : 1;

    const company = await tx.company.create({
      data: {
        name,
        cod: nextCod,
        users: {
          create: {
            userId,
            role: 'ADMIN'
          }
        }
      }
    });

    return company;
  });
}

// Listar empresas do usuário
export async function listCompaniesService(userId) {
  // Se o userId vier vazio por algum erro no token
  if (!userId) {
    throw new AppError("Usuário não identificado", 401);
  }

  const companies = await prisma.userCompany.findMany({
    where: { userId },
    include: { company: true }
  });

  // Se o usuário não tiver empresas, retornamos array vazio (200 OK)
  // O .map limpa a estrutura para o frontend não ter que lidar com o objeto da tabela pivô
  return companies.map(uc => uc.company);
}