import prisma from './../../../database/prisma.js';
import { AppError } from "../../../utils/AppError.js";
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createProduct(companyId, tagIds, productData) {
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
    }, { timeout: 30000 });
}

export async function getAllProducts(companyId, { search, page = 1, limit = 25 } = {}) {
    const skip = (page - 1) * limit;
    const where = { companyId };

    if (search) {
        where.OR = [
            { description: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } }
        ];
    }

    const [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
            where,
            include: {
                category: { select: { id: true, name: true } },
                brand: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
    ]);

    return {
        products,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }
    };
}

export async function getProductById(companyId, id) {
    const product = await prisma.product.findFirst({
        where: { id, companyId },
        include: {
            tags: true,
            category: true,
            brand: true,
            supplier: true
        }
    });

    if (!product) throw new AppError("Produto não encontrado", 404);
    return product;
}

export async function updateProduct(companyId, id, productData, tagIds) {
    const existing = await getProductById(companyId, id);

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
    await getProductById(companyId, id);

    return prisma.product.delete({
        where: { id }
    });
}