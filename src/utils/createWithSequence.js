import prisma from '../database/prisma.js';
import logger from './logger.js';

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
    sale: 'saleSeq',
    saleItem: 'saleItemSeq',
    saleStatus: 'saleStatusSeq',
    budget: 'budgetSeq',
    budgetItem: 'budgetItemSeq',
    bankAccount: 'accountSeq',
    paymentMethod: 'paymentMethodSeq',
    financialCategory: 'financialCategorySeq',
    financialRecord: 'financialRecordSeq',
};

export async function createWithSequence(model, companyId, data, txExternal = null) {

    const run = async (tx) => {
        logger.info(`[createWithSequence] Iniciando criação: ${model} (Empr.: ${companyId})`);

        const sequenceField = sequenceMap[model];
        if (!sequenceField) {
            logger.error(`[createWithSequence] Sequência NÃO CONFIGURADA para model: ${model}`);
            throw new Error(`Sequência não configurada para model: ${model}`);
        }

        try {
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
            logger.info(`[createWithSequence] Cod gerado para ${model}: ${nextCod}`);

            const created = await tx[model].create({
                data: {
                    ...data,
                    cod: nextCod,
                    companyId
                }
            });
            logger.info(`[createWithSequence] Sucesso: ${model} ID: ${created.id}`);
            return created;
        } catch (error) {
            logger.error({
                msg: `[createWithSequence] ERRO AO CRIAR ${model}`,
                error: error.message
            });
            throw error;
        }
    };

    if (txExternal) {
        return run(txExternal);
    }

    return prisma.$transaction(run);
}