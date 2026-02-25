import prisma from '../../../database/prisma.js';

export async function createSupplier(companyId, data) {
    if (!data || Object.keys(data).length === 0) {
        throw new Error('Nenhum campo válido enviado para atualização');
    }

    return prisma.supplier.create({
        data: {
            ...data,
            companyId
        }
    })
}

export async function getAllSupplier(companyId) {

    return prisma.supplier.findMany({
        where: {
            companyId,
        },
        orderBy: { createdAt: 'desc' }
    })    
}

export async function getSupplierById(companyId, id) {

    return prisma.supplier.findFirst({
        where: {
            companyId,
            id
        }
    })
}

export async function updateSupplier(companyId, id, data) {

    const existingSupplier = await prisma.supplier.findFirst({
        where: {
            companyId,
            id
        }
    })

    if (!existingSupplier){
        throw new Error("Fornecedor não encontrado!");
    }

    return prisma.supplier.update({
        where: {
            companyId,
            id
        },
        data
    })
    
}

export async function deleteSupplier(companyId, id) {

    const existingSupplier = await prisma.supplier.findFirst({
        where: {
            companyId,
            id
        }
    })
    
    if (!existingSupplier){
        throw new Error("Fornecedor não encontrado!")
    }

    return prisma.supplier.delete({
        where: {
            companyId,
            id
        }
    })
}