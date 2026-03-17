import dotenv from 'dotenv';
dotenv.config();
import prisma from './src/database/prisma.js';

async function main() {
    try {
        console.log('--- TESTE DE PERSISTÊNCIA FINANCEIRA ---');

        // 1. Verificar se existe ao menos uma empresa
        const company = await prisma.company.findFirst();
        if (!company) {
            console.log('ERRO: Nenhuma empresa cadastrada. Não é possível testar.');
            return;
        }
        console.log('ID Empresa:', company.id);

        // 2. Tentar criar um registro financeiro simples
        const testData = {
            companyId: company.id,
            cod: 9999, // Um código alto para teste
            type: 'RECEIVABLE',
            description: 'TESTE DE SISTEMA - DELETE-ME',
            amount: 10.50,
            dueDate: new Date(),
            status: 'PENDING'
        };

        console.log('Dados do teste:', JSON.stringify(testData, null, 2));

        const record = await prisma.financialRecord.create({
            data: testData
        });

        console.log('SUCESSO! Registro criado com ID:', record.id);

        // 3. Limpar
        await prisma.financialRecord.delete({ where: { id: record.id } });
        console.log('Registro de teste removido.');

    } catch (error) {
        console.error('ERRO NO TESTE DE BANCO:');
        if (error.code) console.error('Código Prisma:', error.code);
        console.error(error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
