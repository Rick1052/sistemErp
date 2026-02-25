import prisma from "../../../database/prisma.js";

export async function createTag(companyId, data) {
    if (!data || Object.keys(data).length === 0) {
        throw new Error('Nenhum campo válido enviado para atualização');
    }

    return prisma.tag.create({
        data: {
            ...data,
            companyId
        }
    })
}

export async function getAllTag(companyId) {
    return prisma.tag.findMany({
        where: {
            companyId
        },
        orderBy: { createdAt: 'desc' }
    })
}

export async function getTagById(companyId, id) {

    return prisma.tag.findFirst({
        where: {
            companyId,
            id
        }
    })
}

export async function updateTag(companyId, id, data) {

    const existingTag = await prisma.tag.findFirst({
        where: {
            companyId,
            id
        }
    })

    if(!existingTag) {
        throw new Error("Marca não encontrada");
    }

    return prisma.tag.update({
        where: {
            companyId,
            id
        },
        data
    })
}

export async function deleteTag(companyId, id) {
    
    const existingTag = await prisma.tag.findFirst({
        where: {
            companyId,
            id
        }
    })

    if (!existingTag){
        throw new Error("Marca não encontrada");
    }

    return prisma.tag.delete({
        where: {
            companyId,
            id
        }
    })

}