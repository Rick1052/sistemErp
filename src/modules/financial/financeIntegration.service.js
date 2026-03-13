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

    // Se não vierem parcelas no array, mas houver um paymentMethodId na venda, criamos uma parcela única
    if ((!installmentsData || installmentsData.length === 0) && sale.paymentMethodId) {
      installmentsData = [{
        paymentMethodId: sale.paymentMethodId,
        amount: Number(sale.total),
        dueDate: new Date()
      }];
    }

    for (const [index, inst] of installmentsData.entries()) {
      const paymentMethod = await client.paymentMethod.findUnique({
        where: { id: inst.paymentMethodId }
      });

      const instDescription = installmentsData.length > 1 
        ? `${description} (${index + 1}/${installmentsData.length})` 
        : description;

      const recordData = {
        type: 'RECEIVABLE',
        description: instDescription,
        amount: Number(inst.amount),
        dueDate: new Date(inst.dueDate),
        paymentMethodId: inst.paymentMethodId,
        saleId: sale.id,
        bankAccountId: paymentMethod?.destinationAccountId,
      };

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
