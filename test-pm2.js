import { paymentMethodService } from './src/modules/financial/paymentMethod.service.js';
import prisma from './src/database/prisma.js';

async function test() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('No company found.');
      return;
    }
    console.log('Fetching for company:', company.id);
    const methods = await paymentMethodService.list(company.id);
    console.log('Success:', methods);
    process.exit(0);
  } catch (err) {
    console.error('ERROR CAUGHT:', err);
    process.exit(1);
  }
}
test();
