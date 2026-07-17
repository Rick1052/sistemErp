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
    nfeEmission: 'nfeEmissionSeq',
    bankAccount: 'accountSeq',
    paymentMethod: 'paymentMethodSeq',
    financialCategory: 'financialCategorySeq',
    financialRecord: 'financialRecordSeq',
};

/**
 * Reserva `count` códigos sequenciais de uma vez (UM upsert em vez de N).
 * Retorna o primeiro cod da faixa: os códigos válidos são firstCod..firstCod+count-1.
 * Reduz drasticamente as round-trips e o tempo de lock na linha de CompanySequence
 * em criações em lote (ex.: itens de uma venda).
 */
export async function reserveSequenceRange(model, companyId, count, tx) {
    const sequenceField = sequenceMap[model];
    if (!sequenceField) {
        throw new Error(`Sequência não configurada para model: ${model}`);
    }
    if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`Quantidade inválida para reserva de sequência: ${count}`);
    }

    const sequence = await tx.companySequence.upsert({
        where: { companyId },
        update: { [sequenceField]: { increment: count } },
        create: { companyId, [sequenceField]: count },
    });

    const lastCod = sequence[sequenceField];
    return lastCod - count + 1;
}

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