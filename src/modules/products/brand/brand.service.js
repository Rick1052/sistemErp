import prisma from "../../../database/prisma.js";
import { AppError } from "../../../utils/AppError.js";
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createBrand(companyId, data) {
    if (!data || !data.name) {
        throw new AppError('O nome da marca é obrigatório', 400);
    }

    return createWithSequence('brand', companyId, data);
}

export async function getAllBrand(companyId) {
    return prisma.brand.findMany({
        where: { companyId },
        orderBy: { name: 'asc' } // Ordem alfabética é mais comum para listas de marcas
    });
}

export async function getBrandById(companyId, id) {
    const brand = await prisma.brand.findFirst({
        where: { id, companyId }
    });

    if (!brand) {
        throw new AppError("Marca não encontrada", 404);
    }

    return brand;
}

export async function updateBrand(companyId, id, data) {
    // Reutilizamos a lógica de busca que já lança o 404 se não existir
    await getBrandById(companyId, id);

    if (!data || Object.keys(data).length === 0) {
        throw new AppError('Nenhum campo enviado para atualização', 400);
    }

    return prisma.brand.update({
        where: { id },
        data
    });
}

export async function deleteBrand(companyId, id) {
    // Garante que a marca existe antes de tentar deletar
    await getBrandById(companyId, id);

    return prisma.brand.delete({
        where: { id }
    });
}