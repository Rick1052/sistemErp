import prisma from "../../../database/prisma.js";

export async function createCategory(companyId, parentId, data) {
    if (!data || Object.keys(data).length === 0) {
        throw new Error('Nenhum campo válido enviado para atualização');
    }

    if (parentId && parentId === id) {
        throw new AppError("Categoria não pode ser filha dela mesma");
    }

    if (parentId) {
        const parent = await prisma.category.findFirst({
            where: {
                id: parentId,
                companyId: req.companyId
            }
        });

        if (!parent) {
            throw new AppError("Categoria pai não encontrada");
        }
    }

    return prisma.category.create({
        data: {
            ...data,
            companyId
        }
    })
}

export async function getAllCategory(companyId) {

    return prisma.category.findMany({
        where: {
            companyId
        },
        orderBy: { name: 'asc' }
    })

}

export async function getCategoryById(companyId, id) {

    return prisma.category.findFirst({
        where: {
            companyId,
            id
        },
        include: {
            children: true
        }
    })

}

export async function updateCategory(companyId, id, data) {
    if (!data || Object.keys(data).length === 0) {
        throw new Error('Nenhum campo válido enviado para atualização');
    }

    const existingCategory = await prisma.category.findFirst({
        where: { id, companyId }
    });

    if (!existingCategory) {
        throw new Error('Cliente não encontrado!');
    }

    return prisma.category.update({
        where: {
            companyId,
            id
        },
        data
    })
}

export async function deleteCategory(companyId, id) {

    return prisma.category.delete({
        where: {
            companyId,
            id
        }
    })

}