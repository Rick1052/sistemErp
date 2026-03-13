import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const warehouses = await prisma.warehouse.count();
  const statuses = await prisma.saleStatus.count();
  const companies = await prisma.company.findMany();
  
  console.log('Warehouses:', warehouses);
  console.log('SaleStatuses:', statuses);
  console.log('Companies:', companies.map(c => ({ id: c.id, name: c.name })));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
