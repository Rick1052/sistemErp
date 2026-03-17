import prisma from '../../../database/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createTax(companyId, data) {
    const { productId, ...taxData } = data;

    const product = await prisma.product.findFirst({
        where: { id: productId, companyId }
    });

    if (!product) throw new AppError('Produto não encontrado', 404);

    const existing = await prisma.productTax.findFirst({
        where: { productId, companyId }
    });

    if (existing) {
        console.log(`[taxService] Registro já existe para o produto ${productId}. Atualizando...`);
        return prisma.productTax.update({
            where: { id: existing.id },
            data: taxData
        });
    }

    console.log(`[taxService] Criando novo registro tributário para produto ${productId}`);
    return createWithSequence('productTax', companyId, data);
}

// O ID aqui é o productId, pois a relação é 1:1
export async function getTaxByProductId(companyId, productId) {
    const tax = await prisma.productTax.findFirst({
        where: { productId, companyId }
    });

    if (!tax) throw new AppError('Configurações de imposto não encontradas', 404);
    return tax;
}

export async function updateTaxByProductId(companyId, productId, data) {
    await getTaxByProductId(companyId, productId); // Valida existência e tenant

    // O Prisma aceita o update no @unique, o que é ótimo!
    return prisma.productTax.update({
        where: { productId },
        data
    });
}