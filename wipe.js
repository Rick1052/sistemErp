import dotenv from 'dotenv';
dotenv.config();
import prisma from './src/database/prisma.js';

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
