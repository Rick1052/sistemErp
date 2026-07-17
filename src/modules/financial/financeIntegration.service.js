import prisma from '../../database/prisma.js';
import { financialRecordService } from './financialRecord.service.js';
import logger from '../../utils/logger.js';
import { parseDateInput } from '../../utils/date.js';
import { AppError } from '../../utils/AppError.js';

export const financeIntegrationService = {
  /**
   * Versão pura (sem DB) do planejamento das parcelas de uma venda, para uso em lote.
   * Recebe os paymentMethods JÁ buscados (Map por id) e classifica cada parcela em
   * `pending` (vai em createMany) ou `immediate` (liquidação imediata via createAndPay).
   * A descrição final (que depende do cod da venda) é montada pelo chamador.
   * Mantém as mesmas regras de generateReceivableFromSale.
   */
  planReceivablesFromSale({ clientId, saleDate, salePaymentMethodId, saleTotal }, installmentsData = [], paymentMethodsById) {
    let insts = installmentsData;
    if ((!insts || insts.length === 0) && salePaymentMethodId) {
      insts = [{
        paymentMethodId: salePaymentMethodId,
        amount: Number(saleTotal),
        dueDate: new Date(),
      }];
    }
    if (!insts || insts.length === 0) return { pending: [], immediate: [] };

    const pending = [];
    const immediate = [];
    const instTotal = insts.length;

    for (const [index, inst] of insts.entries()) {
      if (!inst.paymentMethodId) {
        logger.error(`[financeIntegrationService] Parcela ${index + 1} sem paymentMethodId. Pulando.`);
        continue;
      }
      const paymentMethod = paymentMethodsById.get(inst.paymentMethodId);
      if (!paymentMethod) {
        logger.error(`[financeIntegrationService] Método de pagamento ${inst.paymentMethodId} não encontrado.`);
        continue;
      }

      let finalChequeCustomerId = inst.chequeCustomerId || null;
      if (paymentMethod.name.toLowerCase().includes('cheque')) {
        if (inst.chequeCustomerId && inst.chequeCustomerId !== clientId) {
          throw new AppError('O cliente do cheque deve ser o mesmo cliente que realizou a venda.', 400);
        }
        finalChequeCustomerId = clientId;
      }

      const amount = Number(inst.amount);
      if (isNaN(amount)) {
        logger.error(`[financeIntegrationService] Valor da parcela inválido (${inst.amount}). Pulando.`);
        continue;
      }

      const settlement = paymentMethod.valueDestination || 'RECEIVABLE_ONLY';
      const bankAccountId = settlement === 'BANK_ACCOUNT' ? paymentMethod.destinationAccountId : null;

      const record = {
        type: 'RECEIVABLE',
        amount,
        dueDate: parseDateInput(inst.dueDate),
        date: parseDateInput(saleDate),
        paymentMethodId: inst.paymentMethodId,
        bankAccountId,
        chequeNumber: inst.chequeNumber || null,
        chequeOwner: inst.chequeOwner || null,
        chequeDueDate: inst.chequeDueDate ? parseDateInput(inst.chequeDueDate) : null,
        chequeCustomerId: finalChequeCustomerId,
        chequeHistory: inst.chequeHistory || null,
        instIndex: index,
        instTotal,
      };

      const shouldLiquidateImmediately = Boolean(
        paymentMethod.isImmediate && settlement === 'BANK_ACCOUNT' && bankAccountId
      );

      if (shouldLiquidateImmediately) {
        immediate.push(record);
      } else {
        // Mesmo prefixo de timestamp que financialRecordService.create aplica ao chequeHistory
        const chequeHistory = record.chequeHistory
          ? `[${new Date().toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}] - ${record.chequeHistory}`
          : null;
        pending.push({ ...record, chequeHistory, status: 'PENDING' });
      }
    }

    return { pending, immediate };
  },
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

      let finalChequeCustomerId = inst.chequeCustomerId || null;
      if (paymentMethod.name.toLowerCase().includes('cheque')) {
        if (inst.chequeCustomerId && inst.chequeCustomerId !== sale.clientId) {
          logger.error(`[financeIntegrationService] Tentativa de enviar chequeCustomerId diferente do clientId na venda #${sale.cod}. Bloqueando.`);
          const AppError = (await import('../../utils/AppError.js')).AppError;
          throw new AppError('O cliente do cheque deve ser o mesmo cliente que realizou a venda.', 400);
        }
        finalChequeCustomerId = sale.clientId;
      }

      const instDescription = installmentsData.length > 1
        ? `${description} (${index + 1}/${installmentsData.length})`
        : description;

      const amount = Number(inst.amount);
      if (isNaN(amount)) {
        logger.error(`[financeIntegrationService] Valor da parcela inválido (${inst.amount}). Pulando.`);
        continue;
      }

      const settlement = paymentMethod.valueDestination || 'RECEIVABLE_ONLY';
      const bankAccountId =
        settlement === 'BANK_ACCOUNT' ? paymentMethod.destinationAccountId : null;

      const recordData = {
        type: 'RECEIVABLE',
        description: instDescription,
        amount: amount,
        dueDate: parseDateInput(inst.dueDate),
        date: parseDateInput(sale.date), // Herdar data da venda
        paymentMethodId: inst.paymentMethodId,
        saleId: sale.id,
        bankAccountId,
        chequeNumber: inst.chequeNumber || null,
        chequeOwner: inst.chequeOwner || null,
        chequeDueDate: inst.chequeDueDate ? parseDateInput(inst.chequeDueDate) : null,
        chequeCustomerId: finalChequeCustomerId,
        chequeHistory: inst.chequeHistory || null
      };

      logger.info(`[financeIntegrationService] Criando lançamento: ${instDescription}, R$ ${recordData.amount} (destino=${settlement})`);

      const shouldLiquidateImmediately = Boolean(
        paymentMethod?.isImmediate && settlement === 'BANK_ACCOUNT' && bankAccountId
      );

      if (shouldLiquidateImmediately) {
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
