import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.paymentMethod.findMany()
  .then(res => { console.log('SUCCESS:', res); process.exit(0); })
  .catch(err => { console.error('ERROR:', err); process.exit(1); });
