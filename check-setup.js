import dotenv from 'dotenv';
dotenv.config();
import prisma from './src/database/prisma.js';

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
