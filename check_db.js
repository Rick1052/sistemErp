import prisma from './src/database/prisma.js';

async function checkDb() {
  const company = await prisma.company.findFirst();
  const user = await prisma.user.findFirst();
  const product = await prisma.product.findFirst();
  const client = await prisma.client.findFirst();
  const statuses = await prisma.saleStatus.findMany();

  console.log('Company:', company ? company.id : 'N/A');
  console.log('User:', user ? user.id : 'N/A');
  console.log('Product:', product ? product.id : 'N/A');
  console.log('Client:', client ? client.id : 'N/A');
  console.log('Statuses:', statuses.map(s => `${s.name} (${s.stockAction})`));
}

checkDb()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
