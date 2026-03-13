import prisma from '../../../database/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createFiscal(companyId, data) {
    const existing = await prisma.fiscalClassification.findFirst({
        where: { ncm: data.ncm, companyId }
    });

    if (existing) throw new AppError('Este NCM já está cadastrado', 409);

    return createWithSequence('fiscalClassification', companyId, data);
}

export async function listFiscals(companyId) {
    return prisma.fiscalClassification.findMany({
        where: { companyId },
        orderBy: { ncm: 'asc' }
    });
}

export async function getFiscalById(companyId, id) {
    const fiscal = await prisma.fiscalClassification.findFirst({
        where: { id, companyId }
    });

    if (!fiscal) throw new AppError('Classificação fiscal não encontrada', 404);
    return fiscal;
}

export async function updateFiscal(companyId, id, data) {
    await getFiscalById(companyId, id);

    if (data.ncm) {
        const existing = await prisma.fiscalClassification.findFirst({
            where: { ncm: data.ncm, companyId, id: { not: id } }
        });
        if (existing) throw new AppError('Este NCM já está em uso', 409);
    }

    return prisma.fiscalClassification.update({
        where: { id },
        data
    });
}

export async function deleteFiscal(companyId, id) {
    await getFiscalById(companyId, id);
    return prisma.fiscalClassification.delete({
        where: { id }
    });
}
