import prisma from '../../../database/prisma.js';
import { AppError } from "../../../utils/AppError.js";
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createSupplier(companyId, data) {
    if (!data?.name) {
        throw new AppError('O nome do fornecedor é obrigatório', 400);
    }

    return createWithSequence('supplier', companyId, data);
}

export async function getAllSupplier(companyId) {
    return prisma.supplier.findMany({
        where: { companyId },
        orderBy: { name: 'asc' } // Geralmente fornecedores são listados por nome
    });
}

export async function getSupplierById(companyId, id) {
    const supplier = await prisma.supplier.findFirst({
        where: { id, companyId }
    });

    if (!supplier) {
        throw new AppError("Fornecedor não encontrado", 404);
    }

    return supplier;
}

export async function updateSupplier(companyId, id, data) {
    // Valida se existe e pertence à empresa antes de atualizar
    await getSupplierById(companyId, id);

    if (!data || Object.keys(data).length === 0) {
        throw new AppError('Nenhum dado fornecido para atualização', 400);
    }

    return prisma.supplier.update({
        where: { id },
        data
    });
}

export async function deleteSupplier(companyId, id) {
    // Valida existência
    await getSupplierById(companyId, id);

    // Bônus: Poderíamos checar aqui se o fornecedor tem produtos vinculados 
    // antes de permitir a exclusão (Integridade Referencial)

    return prisma.supplier.delete({
        where: { id }
    });
}