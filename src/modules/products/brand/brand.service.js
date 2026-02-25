import prisma from "../../../database/prisma.js";

export async function createBrand(companyId, data) {
    if (!data || Object.keys(data).length === 0) {
        throw new Error('Nenhum campo válido enviado para atualização');
    }

    return prisma.brand.create({
        data: {
            ...data,
            companyId
        }
    })
}

export async function getAllBrand(companyId) {
    return prisma.brand.findFirst({
        where: {
            companyId
        },
        orderBy: { name: 'desc' }
    })
}

export async function getBrandById(companyId, id) {

    return prisma.brand.findFirst({
        where: {
            companyId,
            id
        }
    })
}

export async function updateBrand(companyId, id, data) {

    const existingBrand = await prisma.brand.findFirst({
        where: {
            companyId,
            id
        }
    })

    if(!existingBrand) {
        throw new Error("Marca não encontrada");
    }

    return prisma.brand.update({
        where: {
            companyId,
            id
        },
        data
    })
}

export async function deleteBrand(companyId, id) {
    
    const existingBrand = await prisma.brand.findFirst({
        where: {
            companyId,
            id
        }
    })

    if (!existingBrand){
        throw new Error("Marca não encontrada");
    }

    return prisma.brand.delete({
        where: {
            companyId,
            id
        }
    })

}