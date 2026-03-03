import prisma from "../../../database/prisma.js";
import { AppError } from "../../../utils/AppError.js";
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createWarehouse(companyId, data) {
    if (!data?.name) {
        throw new AppError('O nome do depósito é obrigatório', 400);
    }

    return createWithSequence('warehouse', companyId, data);
}

export async function getAllWarehouse(companyId) {
    return prisma.warehouse.findMany({
        where: { companyId },
        orderBy: { name: 'asc' }
    });
}

export async function getWarehouseById(companyId, id) {
    const warehouse = await prisma.warehouse.findFirst({
        where: { id, companyId }
    });

    if (!warehouse) {
        throw new AppError("Depósito não encontrado", 404);
    }

    return warehouse;
}

export async function updateWarehouse(companyId, id, data) {
    // Valida existência e tenant isolation
    await getWarehouseById(companyId, id);

    if (!data || Object.keys(data).length === 0) {
        throw new AppError('Nenhum dado enviado para atualização', 400);
    }

    return prisma.warehouse.update({
        where: { id },
        data
    });
}

export async function deleteWarehouse(companyId, id) {
    // Valida existência
    await getWarehouseById(companyId, id);

    // Dica Sênior: Antes de deletar, você poderia verificar se há estoque 
    // vinculado a este warehouse para evitar inconsistência de dados.

    return prisma.warehouse.delete({
        where: { id }
    });
}