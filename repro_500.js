
import prisma from './src/database/prisma.js';
import { saleService } from './src/modules/sales/sale.service.js';

async function test() {
  const company = await prisma.company.findFirst();
  const user = await prisma.user.findFirst();
  const client = await prisma.client.findFirst({ where: { companyId: company.id } });
  const status = await prisma.saleStatus.findFirst({ where: { companyId: company.id, stockAction: 'COMMIT' } });
  const product = await prisma.product.findFirst({ where: { companyId: company.id } });
  const method = await prisma.paymentMethod.findFirst({ where: { companyId: company.id } });

  if (!company || !user || !client || !status || !product || !method) {
    console.error('Missing seed data for test');
    process.exit(1);
  }

  // Total calculation: (2 * 100) - (-10) + 5 = 200 + 10 + 5 = 215.
  const data = {
    clientId: client.id,
    statusId: status.id,
    date: new Date().toISOString().split('T')[0],
    discount: -10, 
    freight: 5,
    items: [
      {
        productId: product.id,
        quantity: 2,
        unitPrice: 100,
        discount: 0
      }
    ],
    installments: [
      {
        paymentMethodId: method.id,
        amount: 215, 
        dueDate: new Date()
      }
    ],
    chequeNumber: '123',
    chequeOwner: 'John Doe',
    chequeDueDate: '2024-12-31',
    chequeCustomerId: client.id
  };

  try {
    console.log('Attempting to create sale...');
    const sale = await saleService.create(company.id, user.id, data);
    console.log('Sale created successfully:', sale.id);
  } catch (error) {
    console.error('FAILED TO CREATE SALE:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
