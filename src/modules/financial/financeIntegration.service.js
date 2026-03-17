import prisma from '../../database/prisma.js';
import { financialRecordService } from './financialRecord.service.js';
import logger from '../../utils/logger.js';

export const financeIntegrationService = {
  /**
   * Gera o financeiro a partir de uma Venda
   */
  async generateReceivableFromSale(companyId, sale, installmentsData = [], tx = null) {
    const client = tx || prisma;
    const description = `Venda #${sale.cod} - Cliente: ${sale.client?.name || 'Não Identificado'}`;
    const records = [];

    logger.info(`[financeIntegrationService] Gerando financeiro para venda #${sale.cod}. Total: ${sale.total}.`);

    // Se não vierem parcelas no array, mas houver um paymentMethodId na venda, criamos uma parcela única
    if ((!installmentsData || installmentsData.length === 0) && sale.paymentMethodId) {
      logger.info(`[financeIntegrationService] Nenhuma parcela fornecida. Usando método de pagamento da venda: ${sale.paymentMethodId}`);
      installmentsData = [{
        paymentMethodId: sale.paymentMethodId,
        amount: Number(sale.total),
        dueDate: new Date()
      }];
    }

    if (installmentsData.length === 0) {
      logger.warn(`[financeIntegrationService] Nenhuma parcela e nenhum método de pagamento na venda #${sale.cod}.`);
      return [];
    }

    for (const [index, inst] of installmentsData.entries()) {
      if (!inst.paymentMethodId) {
        logger.error(`[financeIntegrationService] Parcela ${index + 1} sem paymentMethodId. Pulando.`);
        continue;
      }

      const paymentMethod = await client.paymentMethod.findUnique({
        where: { id: inst.paymentMethodId }
      });

      if (!paymentMethod) {
        logger.error(`[financeIntegrationService] Método de pagamento ${inst.paymentMethodId} não encontrado.`);
        continue;
      }

      const instDescription = installmentsData.length > 1
        ? `${description} (${index + 1}/${installmentsData.length})`
        : description;

      const amount = Number(inst.amount);
      if (isNaN(amount) || amount <= 0) {
        logger.error(`[financeIntegrationService] Valor da parcela inválido (${inst.amount}). Pulando.`);
        continue;
      }

      const recordData = {
        type: 'RECEIVABLE',
        description: instDescription,
        amount: amount,
        dueDate: inst.dueDate ? new Date(inst.dueDate) : new Date(),
        paymentMethodId: inst.paymentMethodId,
        saleId: sale.id,
        bankAccountId: paymentMethod?.destinationAccountId,
      };

      logger.info(`[financeIntegrationService] Criando lançamento: ${instDescription}, R$ ${recordData.amount}`);

      if (paymentMethod?.isImmediate) {
        const record = await financialRecordService.createAndPay(companyId, recordData, client);
        records.push(record);
      } else {
        const record = await financialRecordService.create(companyId, {
          ...recordData,
          status: 'PENDING'
        }, client);
        records.push(record);
      }
    }

    return records;
  },

  /**
   * Gera o financeiro a partir de uma Compra
   */
  async generatePayableFromPurchase(companyId, purchase) {
    const description = `Compra #${purchase.cod} - Fornecedor: ${purchase.supplier?.name || 'Não Identificado'}`;

    const data = {
      type: 'PAYABLE',
      description,
      amount: purchase.total,
      dueDate: new Date(),
      status: 'PENDING',
      purchaseId: purchase.id,
    };

    return financialRecordService.create(companyId, data);
  }
};
