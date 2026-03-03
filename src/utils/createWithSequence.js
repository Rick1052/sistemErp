import prisma from '../database/prisma.js';

const sequenceMap = {
    client: 'clientSeq',
    supplier: 'supplierSeq',
    brand: 'brandSeq',
    category: 'categorySeq',
    tag: 'tagSeq',
    warehouse: 'warehouseSeq',
    product: 'productSeq',
    productTax: 'productTaxSeq',
    productInventory: 'inventorySeq',
    stockMovement: 'stockMovementSeq',
};

export async function createWithSequence(model, companyId, data, txExternal = null) {

    const run = async (tx) => {

        const sequenceField = sequenceMap[model];
        if (!sequenceField) {
            throw new Error(`Sequência não configurada para model: ${model}`);
        }

        const sequence = await tx.companySequence.upsert({
            where: { companyId },
            update: {
                [sequenceField]: { increment: 1 }
            },
            create: {
                companyId,
                [sequenceField]: 1
            }
        });

        const nextCod = sequence[sequenceField];

        return tx[model].create({
            data: {
                ...data,
                cod: nextCod,
                companyId
            }
        });
    };

    if (txExternal) {
        return run(txExternal);
    }

    return prisma.$transaction(run);
}