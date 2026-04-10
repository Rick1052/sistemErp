import prisma from '../src/database/prisma.js';

async function main() {
  const sales = await prisma.sale.findMany({
    take: 5,
    select: { id: true, date: true, total: true }
  });
  console.log('SALES_SAMPLES:', JSON.stringify(sales, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
