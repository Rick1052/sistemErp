import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const id = 'b159bffd-0fd3-4210-ae36-18911b307f4c';
  const record = await prisma.financialRecord.findFirst({
    where: { id },
    include: { 
      sale: { 
        include: { status: true } 
      } 
    }
  });
  console.log(JSON.stringify(record, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
