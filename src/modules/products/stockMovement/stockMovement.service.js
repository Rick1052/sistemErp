import prisma from '../../../database/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { createWithSequence } from "../../../utils/createWithSequence.js";

export async function createStockMovement(companyId, userId, data) {

    const { productId, warehouseId, type, quantity, description } = data;

    if (!productId || !warehouseId || !type || !quantity) {
        throw new AppError('Dados do movimento incompletos', 400);
    }

    return prisma.$transaction(async (tx) => {

        // 🔎 Busca inventário atual
        const inventory = await tx.productInventory.findFirst({
            where: { productId, warehouseId, companyId }
        });

        const currentQty = inventory ? inventory.quantity : 0;
        let finalQuantityForHistory = quantity;
        let newStockValue = 0;

        // 🔐 Validação
        if (type === 'OUT' && currentQty < quantity) {
            throw new AppError(
                `Estoque insuficiente. Saldo atual: ${currentQty}`,
                400
            );
        }

        // 📊 Cálculo do novo saldo
        if (type === 'IN') {
            newStockValue = currentQty + quantity;
        }
        else if (type === 'OUT') {
            newStockValue = currentQty - quantity;
        }
        else if (type === 'BALANCE') {
            newStockValue = quantity;
            finalQuantityForHistory = quantity - currentQty;
        }
        else {
            throw new AppError('Tipo de movimento inválido', 400);
        }

        // 🧾 Cria movimento com sequência
        const movement = await createWithSequence(
            'stockMovement',
            companyId,
            {
                productId,
                warehouseId,
                userId,
                type,
                quantity: finalQuantityForHistory,
                description:
                    type === 'BALANCE'
                        ? `Ajuste de Balanço: de ${currentQty} para ${quantity}. ${description || ''}`
                        : description
            },
            tx
        );

        // 📦 Atualiza inventário
        await tx.productInventory.upsert({
            where: {
                productId_warehouseId: { productId, warehouseId }
            },
            update: {
                quantity: newStockValue
            },
            create: {
                companyId,
                productId,
                warehouseId,
                quantity: newStockValue,
                cod: movement.cod // mantém coerência se quiser rastrear
            }
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
            user: { select: { name: true } }, // Para o frontend mostrar "Movido por: João"
            product: { select: { description: true } },
            warehouse: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
}