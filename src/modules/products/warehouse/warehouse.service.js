import prisma from "../../../database/prisma.js";

export async function createWarehouse(companyId, data) {
    if (!data || Object.keys(data).length === 0) {
        throw new Error('Nenhum campo válido enviado para atualização');
    }

    return prisma.warehouse.create({
        data: {
            ...data,
            companyId
        }
    })
}

export async function getAllWarehouse(companyId) {
    return prisma.warehouse.findMany({
        where: {
            companyId
        },
        orderBy: { createdAt: 'desc' }
    })
}

export async function getWarehouseById(companyId, id) {

    return prisma.warehouse.findFirst({
        where: {
            companyId,
            id
        }
    })
}

export async function updateWarehouse(companyId, id, data) {

    const existingWarehouse = await prisma.warehouse.findFirst({
        where: {
            companyId,
            id
        }
    })

    if(!existingWarehouse) {
        throw new Error("Marca não encontrada");
    }

    return prisma.warehouse.update({
        where: {
            companyId,
            id
        },
        data
    })
}

export async function deleteWarehouse(companyId, id) {
    
    const existingWarehouse = await prisma.warehouse.findFirst({
        where: {
            companyId,
            id
        }
    })

    if (!existingWarehouse){
        throw new Error("Marca não encontrada");
    }

    return prisma.warehouse.delete({
        where: {
            companyId,
            id
        }
    })

}