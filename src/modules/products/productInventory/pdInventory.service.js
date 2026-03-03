import prisma from '../../../database/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createInventory(companyId, data) {

    const [product, warehouse] = await Promise.all([
        prisma.product.findFirst({ where: { id: data.productId, companyId } }),
        prisma.warehouse.findFirst({ where: { id: data.warehouseId, companyId } })
    ]);

    if (!product) throw new AppError('Produto não encontrado', 404);
    if (!warehouse) throw new AppError('Depósito não encontrado', 404);

    const existing = await prisma.productInventory.findFirst({
        where: {
            productId: data.productId,
            warehouseId: data.warehouseId,
            companyId
        }
    });

    if (existing)
        throw new AppError('Já existe estoque para este produto neste depósito', 409);

    return createWithSequence('productInventory', companyId, data);
}

// Busca os estoques de um produto específico em TODOS os depósitos
export async function getInventoryByProduct(companyId, productId) {
    return prisma.productInventory.findMany({
        where: { productId, companyId },
        include: { warehouse: true } // Traz o nome do depósito para o frontend
    });
}

export async function getInventoryById(companyId, id) {
    const inventory = await prisma.productInventory.findFirst({
        where: { id, companyId }
    });
    if (!inventory) throw new AppError("Registro de estoque não encontrado", 404);
    return inventory;
}

export async function updateInventory(companyId, id, data) {
    await getInventoryById(companyId, id); // Valida existência

    return prisma.productInventory.update({
        where: { id },
        data
    });
}