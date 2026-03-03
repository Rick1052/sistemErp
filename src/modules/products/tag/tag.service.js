import prisma from "../../../database/prisma.js";
import { AppError } from "../../../utils/AppError.js";
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createTag(companyId, data) {
    if (!data?.name) {
        throw new AppError('O nome da tag é obrigatório', 400);
    }

    const existing = await prisma.tag.findFirst({
        where: { name: data.name, companyId }
    });

    if (existing) {
        throw new AppError('Você já possui uma tag com este nome', 400);
    }

    return createWithSequence('tag', companyId, data);
}
export async function getAllTag(companyId) {
    return prisma.tag.findMany({
        where: { companyId },
        orderBy: { name: 'asc' } // Tags ficam muito mais fáceis de achar em ordem alfabética
    });
}

export async function getTagById(companyId, id) {
    const tag = await prisma.tag.findFirst({
        where: { id, companyId }
    });

    if (!tag) {
        throw new AppError("Tag não encontrada", 404);
    }

    return tag;
}

export async function updateTag(companyId, id, data) {
    await getTagById(companyId, id); // Valida existência e tenant

    if (!data || Object.keys(data).length === 0) {
        throw new AppError('Nenhum dado enviado para atualização', 400);
    }

    return prisma.tag.update({
        where: { id },
        data
    });
}

export async function deleteTag(companyId, id) {
    await getTagById(companyId, id); // Valida existência

    // O Prisma cuidará da relação Many-to-Many removendo as associações 
    // nos produtos automaticamente se o schema estiver correto.
    return prisma.tag.delete({
        where: { id }
    });
}