import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Apagando registros...");
    await prisma.refreshToken.deleteMany({});
    await prisma.userCompany.deleteMany({});
    await prisma.user.deleteMany({});
    console.log("Usuários apagados!");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
