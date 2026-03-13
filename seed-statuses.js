import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany();
  for (const company of companies) {
    const statusesCount = await prisma.saleStatus.count({ where: { companyId: company.id } });
    if (statusesCount === 0) {
      console.log(`Creating default statuses for company ${company.name}...`);
      await prisma.saleStatus.create({
        data: {
          companyId: company.id,
          cod: 1,
          name: 'Pendente',
          color: '#eab308',
          stockAction: 'RESERVE'
        }
      });
      await prisma.saleStatus.create({
        data: {
          companyId: company.id,
          cod: 2,
          name: 'Faturado',
          color: '#22c55e',
          stockAction: 'COMMIT'
        }
      });
      await prisma.saleStatus.create({
        data: {
          companyId: company.id,
          cod: 3,
          name: 'Cancelado',
          color: '#ef4444',
          stockAction: 'NONE'
        }
      });
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
