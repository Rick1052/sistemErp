import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) return;

  const statuses = [
    { name: 'Aguardando Pagamento', color: '#f59e0b', stockAction: 'RESERVE', cod: 10 },
    { name: 'Em Separação', color: '#3b82f6', stockAction: 'RESERVE', cod: 11 },
    { name: 'Enviado', color: '#8b5cf6', stockAction: 'COMMIT', cod: 12 },
    { name: 'Entregue', color: '#10b981', stockAction: 'COMMIT', cod: 13 },
  ];

  for (const s of statuses) {
    const exists = await prisma.saleStatus.findFirst({ where: { name: s.name, companyId: company.id } });
    if (!exists) {
      console.log(`Adding status: ${s.name}`);
      await prisma.saleStatus.create({
        data: {
          ...s,
          companyId: company.id
        }
      });
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
