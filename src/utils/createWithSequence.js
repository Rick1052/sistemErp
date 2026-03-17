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
    sale: 'saleSeq',
    saleItem: 'saleItemSeq',
    saleStatus: 'saleStatusSeq',
    bankAccount: 'accountSeq',
    paymentMethod: 'paymentMethodSeq',
    financialCategory: 'financialCategorySeq',
    financialRecord: 'financialRecordSeq',
};

export async function createWithSequence(model, companyId, data, txExternal = null) {

    const run = async (tx) => {
        console.log(`[createWithSequence] Criando record para model: ${model}, companyId: ${companyId}`);
        const sequenceField = sequenceMap[model];
        if (!sequenceField) {
            console.error(`[createWithSequence] Sequência NÃO CONFIGURADA para model: ${model}`);
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
            console.log(`[createWithSequence] Proximo cod gerado para ${model}: ${nextCod}`);

            const created = await tx[model].create({
                data: {
                    ...data,
                    cod: nextCod,
                    companyId
                }
            });
            console.log(`[createWithSequence] Record criado com sucesso: ${model} ID: ${created.id}`);
            return created;
        } catch (error) {
            console.error(`[createWithSequence] ERRO AO CRIAR ${model}:`, error);
            throw error;
        }
    };

    if (txExternal) {
        return run(txExternal);
    }

    return prisma.$transaction(run);
}