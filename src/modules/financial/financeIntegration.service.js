import prisma from '../../database/prisma.js';
import { financialRecordService } from './financialRecord.service.js';

export const financeIntegrationService = {
  /**
   * Gera o financeiro a partir de uma Venda
   */
  async generateReceivableFromSale(companyId, sale, installmentsData = [], tx = null) {
    const client = tx || prisma;
    const description = `Venda #${sale.cod} - Cliente: ${sale.client?.name || 'Não Identificado'}`;
    const records = [];

    console.log(`[financeIntegrationService] Gerando financeiro para venda #${sale.cod}. Total: ${sale.total}. Parcelas fornecidas: ${installmentsData.length}`);

    // Se não vierem parcelas no array, mas houver um paymentMethodId na venda, criamos uma parcela única
    if ((!installmentsData || installmentsData.length === 0) && sale.paymentMethodId) {
      console.log(`[financeIntegrationService] Nenhuma parcela fornecida. Usando método de pagamento da venda: ${sale.paymentMethodId}`);
      installmentsData = [{
        paymentMethodId: sale.paymentMethodId,
        amount: Number(sale.total),
        dueDate: new Date()
      }];
    }

    if (installmentsData.length === 0) {
      console.warn(`[financeIntegrationService] Nenhuma parcela e nenhum método de pagamento na venda #${sale.cod}. Nenhum registro financeiro será gerado.`);
      return [];
    }

    for (const [index, inst] of installmentsData.entries()) {
      if (!inst.paymentMethodId) {
        console.error(`[financeIntegrationService] Parcela ${index + 1} sem paymentMethodId. Pulando.`);
        continue;
      }

      const paymentMethod = await client.paymentMethod.findUnique({
        where: { id: inst.paymentMethodId }
      });

      if (!paymentMethod) {
        console.error(`[financeIntegrationService] Método de pagamento ${inst.paymentMethodId} não encontrado.`);
        continue;
      }

      const instDescription = installmentsData.length > 1
        ? `${description} (${index + 1}/${installmentsData.length})`
        : description;

      const amount = Number(inst.amount);
      if (isNaN(amount) || amount <= 0) {
        console.error(`[financeIntegrationService] Valor da parcela inválido (${inst.amount}). Pulando.`);
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

      console.log(`[financeIntegrationService] Criando registro: ${instDescription}, Valor: ${recordData.amount}, Imediato: ${paymentMethod?.isImmediate}`);

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
    // Lógica similar para compras, mas com tipo PAYABLE
    const description = `Compra #${purchase.cod} - Fornecedor: ${purchase.supplier?.name || 'Não Identificado'}`;

    // Simplificado para pendente por enquanto
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
