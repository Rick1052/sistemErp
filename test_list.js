
import prisma from './src/database/prisma.js';
import { saleService } from './src/modules/sales/sale.service.js';

async function test() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) {
      console.error('No company found');
      return;
    }
    console.log('Fetching sales for company:', company.id);
    const result = await saleService.list(company.id, { page: 1, limit: 10 });
    console.log('SUCCESS: Fetched', result.sales.length, 'sales');
  } catch (error) {
    console.error('FAILED TO LIST SALES:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
