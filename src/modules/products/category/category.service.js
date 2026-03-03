import prisma from "../../../database/prisma.js";
import { AppError } from "../../../utils/AppError.js";
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createCategory(companyId, data) {

    if (!data?.name)
        throw new AppError("O nome da categoria é obrigatório", 400);

    if (data.parentId) {
        const parent = await prisma.category.findFirst({
            where: { id: data.parentId, companyId }
        });

        if (!parent)
            throw new AppError("Categoria pai inválida", 404);
    }

    return createWithSequence('category', companyId, data);
}

export async function getAllCategory(companyId) {
    return prisma.category.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } } // Bônus: mostra quantos produtos há na categoria
    });
}

export async function getCategoryById(companyId, id) {
    const category = await prisma.category.findFirst({
        where: { id, companyId },
        include: { children: true }
    });

    if (!category) throw new AppError("Categoria não encontrada", 404);

    return category;
}

export async function updateCategory(companyId, id, data) {
    await getCategoryById(companyId, id); // Valida existência

    if (data.parentId === id) {
        throw new AppError("Uma categoria não pode ser pai de si mesma", 400);
    }

    return prisma.category.update({
        where: { id },
        data
    });
}

export async function deleteCategory(companyId, id) {
    const category = await getCategoryById(companyId, id);

    // Validação Profissional: Não permitir deletar categoria que tem subcategorias ou produtos
    const hasChildren = await prisma.category.count({ where: { parentId: id } });
    if (hasChildren > 0) {
        throw new AppError("Não é possível excluir uma categoria que possui subcategorias", 400);
    }

    return prisma.category.delete({
        where: { id }
    });
}