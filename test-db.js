import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Tentando conectar ao banco de dados...");
        await prisma.$connect();
        console.log("✅ Conexão com o banco de dados estabelecida com sucesso!");

        // Tentando uma query simples
        const userCount = await prisma.user.count();
        console.log(`✅ Query executada com sucesso. Total de usuários no banco: ${userCount}`);

    } catch (error) {
        console.error("❌ Erro ao conectar no banco:", error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
