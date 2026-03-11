import prisma from '../../../database/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function registerEntry(companyId, userId, data) {
    const { productId, warehouseId, quantity, unitCost, reason, documentRef, description } = data;

    if (!productId || !warehouseId || !quantity || !unitCost || !reason) {
        throw new AppError('Dados de entrada de estoque incompletos (requer unitCost e reason)', 400);
    }

    if (quantity <= 0) throw new AppError('Quantidade deve ser maior que zero', 400);

    return prisma.$transaction(async (tx) => {
        // 1. Get Product
        const product = await tx.product.findFirst({
            where: { id: productId, companyId }
        });
        if (!product) throw new AppError('Produto não encontrado', 404);

        // 2. Calculate New Average Cost (CMV/MAP)
        const currentQty = product.physicalStock;
        const currentAvgCost = Number(product.averageCost || 0);
        const inQty = quantity;
        const inUnitCost = Number(unitCost);

        let newAverageCost = currentAvgCost;
        if (currentQty + inQty > 0) {
            const totalValueBefore = currentQty * currentAvgCost;
            const totalValueIn = inQty * inUnitCost;
            newAverageCost = (totalValueBefore + totalValueIn) / (currentQty + inQty);
        }

        const newPhysicalStock = currentQty + inQty;

        // 3. Register immutable Movement
        const movement = await createWithSequence(
            'stockMovement',
            companyId,
            {
                productId,
                warehouseId,
                userId,
                type: 'IN',
                quantity: inQty,
                unitCost: inUnitCost,
                reason,
                documentRef,
                description
            },
            tx
        );

        // 4. Update Product
        await tx.product.update({
            where: { id: productId },
            data: {
                physicalStock: newPhysicalStock,
                averageCost: newAverageCost
            }
        });

        // 5. Update Inventory (optional location tracking)
        await tx.productInventory.upsert({
            where: { productId_warehouseId: { productId, warehouseId } },
            update: { quantity: { increment: inQty } },
            create: { companyId, productId, warehouseId, quantity: inQty }
        });

        return movement;
    });
}

export async function registerExit(companyId, userId, data) {
    const { productId, warehouseId, quantity, reason, documentRef, description } = data;

    if (!productId || !warehouseId || !quantity || !reason) {
        throw new AppError('Dados de saída incompletos (requer reason)', 400);
    }

    if (quantity <= 0) throw new AppError('Quantidade deve ser maior que zero', 400);

    return prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
            where: { id: productId, companyId }
        });
        if (!product) throw new AppError('Produto não encontrado', 404);

        if (product.physicalStock < quantity) {
            throw new AppError(`Estoque Insuficiente. Físico: ${product.physicalStock}. Solicitado: ${quantity}`, 400);
        }

        // Output cost is generally recorded as the current average cost
        const currentAvgCost = product.averageCost;

        const movement = await createWithSequence(
            'stockMovement',
            companyId,
            {
                productId,
                warehouseId,
                userId,
                type: 'OUT',
                quantity,
                unitCost: currentAvgCost,
                reason,
                documentRef,
                description
            },
            tx
        );

        await tx.product.update({
            where: { id: productId },
            data: { physicalStock: { decrement: quantity } }
        });

        // Decrement local inventory
        const inventory = await tx.productInventory.findFirst({
            where: { productId, warehouseId, companyId }
        });
        
        if (inventory) {
            await tx.productInventory.update({
                where: { id: inventory.id },
                data: { quantity: { decrement: quantity } }
            });
        }

        return movement;
    });
}

export async function reserveStock(companyId, userId, data) {
    const { productId, warehouseId, quantity, reason, documentRef, description } = data;

    if (!productId || !quantity || !reason) {
        throw new AppError('Dados de reserva incompletos', 400);
    }
    if (quantity <= 0) throw new AppError('Quantidade reserva deve ser maior que zero', 400);

    return prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
            where: { id: productId, companyId }
        });
        if (!product) throw new AppError('Produto não encontrado', 404);

        const available = product.physicalStock - product.reservedStock;
        if (available < quantity) {
            throw new AppError(`Estoque Disponível Insuficiente. Disponível: ${available}. Solicitado: ${quantity}`, 400);
        }

        // Optional: register reserve in ledger
        const movement = await createWithSequence(
            'stockMovement',
            companyId,
            {
                productId,
                warehouseId: warehouseId || (await getDefaultWarehouse(tx, companyId)), 
                userId,
                type: 'RESERVE',
                quantity,
                reason,
                documentRef,
                description
            },
            tx
        );

        await tx.product.update({
            where: { id: productId },
            data: { reservedStock: { increment: quantity } }
        });

        return movement;
    });
}

// Helper para buscar first warehouse if none is provided on reserves
async function getDefaultWarehouse(tx, companyId) {
    const w = await tx.warehouse.findFirst({ where: { companyId } });
    if (!w) throw new AppError('Nenhum armazém cadastrado', 400);
    return w.id;
}

export async function releaseReserve(companyId, userId, data) {
    const { productId, warehouseId, quantity, reason, documentRef, description } = data;

    if (!productId || !quantity || !reason) {
        throw new AppError('Dados para soltar reserva incompletos', 400);
    }
    if (quantity <= 0) throw new AppError('Quantidade deve ser maior que zero', 400);

    return prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
            where: { id: productId, companyId }
        });
        if (!product) throw new AppError('Produto não encontrado', 404);

        if (product.reservedStock < quantity) {
            throw new AppError('Tentando soltar mais reserva do que o produto possui', 400);
        }

        const movement = await createWithSequence(
            'stockMovement',
            companyId,
            {
                productId,
                warehouseId: warehouseId || (await getDefaultWarehouse(tx, companyId)), 
                userId,
                type: 'RELEASE_RESERVE',
                quantity,
                reason,
                documentRef,
                description
            },
            tx
        );

        await tx.product.update({
            where: { id: productId },
            data: { reservedStock: { decrement: quantity } }
        });

        return movement;
    });
}

export async function getStockMovements(companyId, filters = {}) {
    const { productId, warehouseId } = filters;

    return prisma.stockMovement.findMany({
        where: {
            companyId,
            ...(productId && { productId }),
            ...(warehouseId && { warehouseId })
        },
        include: {
            user: { select: { name: true } }, 
            product: { select: { description: true } },
            warehouse: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
}