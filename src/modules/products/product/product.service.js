import prisma from './../../../database/prisma.js';
import { AppError } from "../../../utils/AppError.js";
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createProduct(companyId, tagIds, productData) {

    if (!productData.description)
        throw new AppError("A descrição do produto é obrigatória", 400);

    const existing = await prisma.product.findFirst({
        where: {
            description: productData.description,
            companyId
        }
    });

    if (existing)
        throw new AppError("Já existe produto com essa descrição", 409);

    return prisma.$transaction(async (tx) => {

        const product = await createWithSequence(
            'product',
            companyId,
            {
                ...productData,
                tags: tagIds?.length
                    ? { connect: tagIds.map(id => ({ id })) }
                    : undefined
            },
            tx
        );

        return tx.product.findUnique({
            where: { id: product.id },
            include: { tags: true, category: true, brand: true }
        });
    });
}

export async function getAllProducts(companyId) {
    return prisma.product.findMany({
        where: { companyId },
        include: { category: true, brand: true }, // Facilita a vida do frontend na listagem
        orderBy: { createdAt: 'desc' }
    });
}

export async function getProductById(companyId, id) {
    const product = await prisma.product.findFirst({
        where: { id, companyId },
        include: {
            tags: true,
            category: true,
            brand: true,
            supplier: true // Trazendo o fornecedor também
        }
    });

    if (!product) throw new AppError("Produto não encontrado", 404);
    return product;
}

export async function updateProduct(companyId, id, productData, tagIds) {
    // Valida existência chamando a função acima
    const existing = await getProductById(companyId, id);

    // Validação de duplicidade ao renomear
    if (productData.description && productData.description !== existing.description) {
        const duplicate = await prisma.product.findFirst({
            where: {
                description: productData.description,
                companyId,
                id: { not: id }
            }
        });
        if (duplicate) throw new AppError("Já existe outro produto com esta descrição", 400);
    }

    return prisma.product.update({
        where: { id },
        data: {
            ...productData,
            tags: tagIds ? {
                set: tagIds.map(tagId => ({ id: tagId }))
            } : undefined
        },
        include: { tags: true }
    });
}

export async function deleteProduct(companyId, id) {
    await getProductById(companyId, id); // Valida se existe e se é da empresa

    return prisma.product.delete({
        where: { id }
    });
}