import prisma from '../../database/prisma.js'

// Criar empresa
export async function createCompanyService(userId, name) {
  const company = await prisma.company.create({
    data: {
      name,
      users: {
        create: { userId, role: 'ADMIN' } // Usuário logado vira ADMIN
      }
    }
  })
  return company
}

// Listar empresas do usuário
export async function listCompaniesService(userId) {
  const companies = await prisma.userCompany.findMany({
    where: { userId },
    include: { company: true }
  })
  return companies.map(uc => uc.company)
}
