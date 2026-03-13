import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const companies = await prisma.company.findMany();
  console.log('USERS_COUNT:', users.length);
  console.log('COMPANIES_COUNT:', companies.length);
  if (users.length > 0) {
    console.log('FIRST_USER_ID:', users[0].id);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
