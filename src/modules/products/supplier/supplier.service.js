import prisma from '../../../database/prisma.js';
import { AppError } from "../../../utils/AppError.js";
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createSupplier(companyId, data) {
    if (!data?.name) {
        throw new AppError('O nome do fornecedor é obrigatório', 400);
    }

    return createWithSequence('supplier', companyId, data);
}

export async function getAllSupplier(companyId, { search, page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;
    const where = { companyId };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { document: { contains: search, mode: 'insensitive' } }
        ];
    }

    const [total, suppliers] = await Promise.all([
        prisma.supplier.count({ where }),
        prisma.supplier.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: page ? skip : undefined,
            take: limit ? limit : undefined
        }),
    ]);

    // If no pagination was requested (page/limit undefined), we could return the array directly
    // but for consistency with other modules, we return the object.
    return {
        suppliers,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
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
    await getSupplierById(companyId, id);

    return prisma.supplier.delete({
        where: { id }
    });
}