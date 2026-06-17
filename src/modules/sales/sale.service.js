import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from "../../utils/createWithSequence.js";
import { financeIntegrationService } from "../financial/financeIntegration.service.js";
import logger from '../../utils/logger.js';
import { parseDateInput } from '../../utils/date.js';

export const saleService = {
  async list(companyId, { page = 1, limit = 25, startDate, endDate, search, statusId }) {
    const skip = (page - 1) * limit;
    const where = { companyId };

    if (statusId) where.statusId = String(statusId);

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const d = parseDateInput(startDate);
        d.setUTCHours(0, 0, 0, 0);
        where.date.gte = d;
      }
      if (endDate) {
        const d = parseDateInput(endDate);
        d.setUTCHours(23, 59, 59, 999);
        where.date.lte = d;
      }
    }

    if (search) {
      const s = String(search).trim();
      const onlyDigits = s.replace(/\D/g, '');
      const cod = Number(onlyDigits || s);
      const hasCod = Number.isFinite(cod) && !Number.isNaN(cod);

      where.OR = [
        { client: { is: { name: { contains: s, mode: 'insensitive' } } } },
        { client: { is: { document: { contains: onlyDigits || s, mode: 'insensitive' } } } },
      ];

      if (hasCod) {
        where.OR.push({ cod });
      }
    }

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, document: true } },
          status: true,
          _count: { select: { financialRecords: true } },
        },
        orderBy: { cod: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      sales,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(companyId, id, tx = null) {
    const client = tx || prisma;
    const sale = await client.sale.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        status: true,
        chequeCustomer: { select: { id: true, name: true, document: true } },
        items: {
          include: {
            product: { select: { id: true, description: true, code: true } },
          },
        },
        financialRecords: true,
      },
    });

    if (!sale) throw new AppError('Venda não encontrada', 404);
    return sale;
  },

  async create(companyId, userId, data) {
    const { 
      items, 
      discount = 0, 
      freight = 0, 
      statusId, 
      installments = [], 
      paymentMethodId, 
      chequeNumber,
      chequeOwner,
      chequeDueDate,
      chequeCustomerId,
      chequeHistory,
      ...saleData 
    } = data;

    // Persistir as parcelas planejadas para uso futuro se for Rascunho
    const installmentsData = installments;

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      const itemTotal = (item.unitPrice - (item.discount || 0)) * item.quantity;
      subtotal += itemTotal;
    }
    const total = subtotal - discount + freight;

    // Validação básica de parcelas
    if (installments && installments.length > 0) {
      const totalInstallments = installments.reduce((sum, inst) => sum + Number(inst.amount), 0);
      if (Math.abs(totalInstallments - total) > 0.01) {
        throw new AppError('A soma das parcelas deve ser igual ao total da venda.', 400);
      }
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Get status details
        const saleStatus = await tx.saleStatus.findFirst({
          where: { id: statusId, companyId }
        });
        if (!saleStatus) throw new AppError('Status de venda não encontrado', 404);

        // 2. Create Sale with sequence
        const sale = await createWithSequence('sale', companyId, {
          ...saleData,
          statusId,
          paymentMethodId, // Salvar no modelo Sale
          installmentsData, // Salvar no modelo Sale (JSON)
          chequeNumber, // Salvar no modelo Sale
          chequeOwner, // Salvar no modelo Sale
          chequeDueDate, // Salvar no modelo Sale
          chequeCustomerId, // Salvar no modelo Sale
          chequeHistory, // Salvar no modelo Sale
          subtotal,
          discount,
          freight,
          total,
        }, tx);

        // 3. Create items and handle stock action
        const warehouse = saleStatus.stockAction !== 'NONE'
          ? await saleService._resolveWarehouse(tx, companyId)
          : null;

        for (const item of items) {
          const itemTotal = (item.unitPrice - (item.discount || 0)) * item.quantity;

          await createWithSequence('saleItem', companyId, {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: itemTotal,
          }, tx);

          await saleService._applyStockAction(tx, companyId, userId, sale, item, saleStatus.stockAction, warehouse);
        }

        // 4. Generate financial record if status is COMMIT
        if (saleStatus.stockAction === 'COMMIT') {
          logger.info(`[saleService.create] Gerando financeiro para venda recém-criada ${sale.id}`);
          const detailedSale = await saleService.getById(companyId, sale.id, tx);
          // Injetar dados do cheque nas parcelas para o financeiro
          const installmentsWithCheque = installments.map((inst) => ({
            ...inst,
            chequeNumber: inst.chequeNumber || chequeNumber,
            chequeOwner: inst.chequeOwner || chequeOwner,
            chequeDueDate: inst.chequeDueDate || chequeDueDate,
            chequeCustomerId: inst.chequeCustomerId || chequeCustomerId,
            chequeHistory: inst.chequeHistory || chequeHistory,
          }));
          await financeIntegrationService.generateReceivableFromSale(companyId, detailedSale, installmentsWithCheque, tx);
        }

        return saleService.getById(companyId, sale.id, tx);
      }, { timeout: 30000 });
    } catch (error) {
      logger.error({
        msg: 'ERRO CRÍTICO NA CRIAÇÃO DE VENDA',
        error: error.message,
        code: error.code,
        stack: error.stack,
        companyId,
        userId
      });
      throw error;
    }
  },

  async update(companyId, userId, id, data) {
    const { 
      items, 
      discount = 0, 
      freight = 0, 
      statusId, 
      installments = [], 
      paymentMethodId,
      chequeNumber,
      chequeOwner,
      chequeDueDate,
      chequeCustomerId,
      chequeHistory,
      ...saleData 
    } = data;

    const installmentsData = installments;

    try {
      return await prisma.$transaction(async (tx) => {
        const oldSale = await tx.sale.findFirst({
          where: { id, companyId },
          include: { items: true, status: true }
        });
        if (!oldSale) throw new AppError('Venda não encontrada', 404);

        // 1. Rollback old stock actions
        const rollbackWarehouse = oldSale.status.stockAction !== 'NONE'
          ? await saleService._resolveWarehouse(tx, companyId)
          : null;

        for (const item of oldSale.items) {
          await saleService._rollbackStockAction(tx, companyId, userId, oldSale, item, oldSale.status.stockAction, false, rollbackWarehouse);
        }

        // 2. Delete old items
        await tx.saleItem.deleteMany({ where: { saleId: id } });

        // 3. Get new status
        const newStatus = await tx.saleStatus.findFirst({
          where: { id: statusId, companyId }
        });
        if (!newStatus) throw new AppError('Novo status não encontrado', 404);

        // 4. Calculate new totals
        let subtotal = 0;
        for (const item of items) {
          const itemTotal = (item.unitPrice - (item.discount || 0)) * item.quantity;
          subtotal += itemTotal;
        }
        const total = subtotal - discount + freight;

        // Validação básica de parcelas
        if (installments && installments.length > 0) {
          const totalInstallments = installments.reduce((sum, inst) => sum + Number(inst.amount), 0);
          if (Math.abs(totalInstallments - total) > 0.01) {
            throw new AppError('A soma das parcelas deve ser igual ao total da venda.', 400);
          }
        }

        // 5. Update Sale
        const updatedSale = await tx.sale.update({
          where: { id },
          data: {
            ...saleData,
            statusId,
            paymentMethodId, // Atualizar no modelo Sale
            installmentsData, // Atualizar no modelo Sale (JSON)
            chequeNumber, // Atualizar no modelo Sale
            chequeOwner, // Atualizar no modelo Sale
            chequeDueDate, // Atualizar no modelo Sale
            chequeCustomerId, // Atualizar no modelo Sale
            chequeHistory, // Atualizar no modelo Sale
            subtotal,
            discount,
            freight,
            total,
          }
        });

        // 6. Create new items and apply new stock actions
        const applyWarehouse = newStatus.stockAction !== 'NONE'
          ? await saleService._resolveWarehouse(tx, companyId)
          : null;

        for (const item of items) {
          const itemTotal = (item.unitPrice - (item.discount || 0)) * item.quantity;

          await createWithSequence('saleItem', companyId, {
            saleId: updatedSale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: itemTotal,
          }, tx);

          await saleService._applyStockAction(tx, companyId, userId, updatedSale, item, newStatus.stockAction, applyWarehouse);
        }

        // 7. Generate financial record if status is COMMIT and it wasn't COMMIT before
        if (newStatus.stockAction === 'COMMIT') {
          const detailedSale = await saleService.getById(companyId, updatedSale.id, tx);
          // Check if already has a record to avoid duplicates on edits
          const existingRecord = await tx.financialRecord.findFirst({ where: { saleId: id } });
          if (!existingRecord) {
            // Injetar dados do cheque nas parcelas para o financeiro
            const installmentsWithCheque = installments.map((inst) => ({
              ...inst,
              chequeNumber: inst.chequeNumber || chequeNumber,
              chequeOwner: inst.chequeOwner || chequeOwner,
              chequeDueDate: inst.chequeDueDate || chequeDueDate,
              chequeCustomerId: inst.chequeCustomerId || chequeCustomerId,
              chequeHistory: inst.chequeHistory || chequeHistory,
            }));
            await financeIntegrationService.generateReceivableFromSale(companyId, detailedSale, installmentsWithCheque, tx);
          }
        }

        return saleService.getById(companyId, updatedSale.id, tx);
      }, { timeout: 30000 });
    } catch (error) {
      logger.error({
        msg: 'ERRO CRÍTICO NA EDIÇÃO DE VENDA',
        error: error.message,
        code: error.code,
        stack: error.stack,
        id,
        companyId,
        userId
      });
      throw error;
    }
  },

  async delete(companyId, userId, id) {
    try {
      return await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id, companyId },
          include: { items: true, status: true, financialRecords: true }
        });
        if (!sale) throw new AppError('Venda não encontrada', 404);

        // Regra de Negócio: Exclusão de Vendas
        const statusName = sale.status.name.toUpperCase();
        const allowedStatuses = ['OPEN', 'DRAFT', 'EM ABERTO', 'RASCUNHO', 'CANCELADO', 'CANCELED', 'CANCELADA'];
        
        if (!allowedStatuses.includes(statusName) || (sale.financialRecords && sale.financialRecords.length > 0)) {
          throw new AppError("Não é possível excluir um pedido processado. Altere a situação para 'Em Aberto' ou 'Cancelado' para estornar os lançamentos antes de excluir.", 400);
        }

        // Rollback stock actions (RESERVE)
        const rollbackWarehouse = sale.status.stockAction !== 'NONE'
          ? await saleService._resolveWarehouse(tx, companyId)
          : null;

        for (const item of sale.items) {
          await saleService._rollbackStockAction(tx, companyId, userId, sale, item, sale.status.stockAction, false, rollbackWarehouse);
        }

        // Delete items and sale
        await tx.saleItem.deleteMany({ where: { saleId: id } });
        await tx.sale.delete({ where: { id } });

        return { message: 'Venda excluída com sucesso' };
      }, { timeout: 30000 });
    } catch (error) {
      logger.error('ERRO CRÍTICO NA EXCLUSÃO DE VENDA:', error);
      throw error;
    }
  },

  // Helper methodologies for Stock Actions
  async _resolveWarehouse(tx, companyId) {
    const warehouse = await tx.warehouse.findFirst({ where: { companyId } });
    if (!warehouse) throw new AppError('Depósito não encontrado.', 400);
    return warehouse;
  },

  async _applyStockAction(tx, companyId, userId, sale, item, action, warehouse = null) {
    if (action === 'NONE') return;

    const resolvedWarehouse = warehouse || await saleService._resolveWarehouse(tx, companyId);

    if (action === 'RESERVE') {
      await tx.product.update({
        where: { id: item.productId },
        data: { reservedStock: { increment: item.quantity } }
      });

      await createWithSequence('stockMovement', companyId, {
        productId: item.productId,
        userId,
        type: 'RESERVE',
        quantity: item.quantity,
        reason: `Reserva Pedido ${sale.cod}`,
        documentRef: String(sale.cod),
        warehouseId: resolvedWarehouse.id
      }, tx);
    }

    if (action === 'COMMIT') {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          physicalStock: { decrement: item.quantity },
          // No necessity to decrement reservedStock here as CREATE doesn't transition from RESERVE
        }
      });

      await createWithSequence('stockMovement', companyId, {
        productId: item.productId,
        userId,
        type: 'OUT',
        quantity: item.quantity,
        reason: `Venda Direta Pedido ${sale.cod}`,
        documentRef: String(sale.cod),
        warehouseId: resolvedWarehouse.id
      }, tx);
    }
  },

  async _rollbackStockAction(tx, companyId, userId, sale, item, action, allowCommitRollback = false, warehouse = null) {
    if (action === 'NONE') return;

    const resolvedWarehouse = warehouse || await saleService._resolveWarehouse(tx, companyId);

    if (action === 'RESERVE') {
      await tx.product.update({
        where: { id: item.productId },
        data: { reservedStock: { decrement: item.quantity } }
      });

      await createWithSequence('stockMovement', companyId, {
        productId: item.productId,
        userId,
        type: 'RELEASE_RESERVE',
        quantity: item.quantity,
        reason: `Estorno Reserva Pedido ${sale.cod}`,
        documentRef: String(sale.cod),
        warehouseId: resolvedWarehouse.id
      }, tx);
    }
    
    if (action === 'COMMIT') {
      if (!allowCommitRollback) {
        throw new AppError('Não é possível editar ou excluir um pedido já faturado/com estoque baixado.', 400);
      }
      
      await tx.product.update({
        where: { id: item.productId },
        data: { physicalStock: { increment: item.quantity } }
      });

      await createWithSequence('stockMovement', companyId, {
        productId: item.productId,
        userId,
        type: 'IN',
        quantity: item.quantity,
        reason: `Estorno Venda Pedido ${sale.cod}`,
        documentRef: String(sale.cod),
        warehouseId: resolvedWarehouse.id
      }, tx);
    }
  },

  async updateStatus(companyId, userId, id, statusId, installments = []) {
    try {
      logger.info(`[saleService.updateStatus] >>> INICIO UPDATE STATUS: Venda=${id}, NovoStatus=${statusId}`);

      return await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id, companyId },
          include: { items: true, status: true }
        });

        if (!sale) {
          logger.error(`[saleService.updateStatus] Venda ${id} não encontrada para a empresa ${companyId}`);
          throw new AppError('Venda não encontrada', 404);
        }

        if (sale.statusId === statusId) {
          logger.info(`[saleService.updateStatus] Status já é o mesmo (${statusId}). Retornando.`);
          return sale;
        }

        const oldStatus = sale.status;
        const newStatus = await tx.saleStatus.findFirst({
          where: { id: statusId, companyId }
        });

        if (!newStatus) {
          logger.error(`[saleService.updateStatus] Novo status ${statusId} não encontrado`);
          throw new AppError('Novo status não encontrado', 404);
        }

        logger.info(`[saleService.updateStatus] Transição de estoque: ${oldStatus.stockAction} -> ${newStatus.stockAction}`);

        const newStatusName = newStatus.name.toUpperCase();
        const isReopening = ['OPEN', 'DRAFT', 'EM ABERTO', 'RASCUNHO', 'CANCELADO', 'CANCELED', 'CANCELADA'].includes(newStatusName);

        if (isReopening) {
          const financialRecords = await tx.financialRecord.findMany({ where: { saleId: id } });
          const hasPaid = financialRecords.some(r => r.status === 'PAID');
          if (hasPaid) {
            throw new AppError("Existe um recebimento já liquidado para este pedido. Estorne o pagamento no módulo financeiro antes de reabrir ou cancelar o pedido.", 400);
          }
          if (financialRecords.length > 0) {
            await tx.financialRecord.deleteMany({ where: { saleId: id, status: 'PENDING' } });
          }
        }

        // 1. Reverter ação de estoque ANTIGA
        const rollbackWarehouse = oldStatus.stockAction !== 'NONE'
          ? await saleService._resolveWarehouse(tx, companyId)
          : null;

        if (sale.items && sale.items.length > 0) {
          logger.info(`[saleService.updateStatus] Revertendo estoque para ${sale.items.length} itens (Ação: ${oldStatus.stockAction})`);
          for (const item of sale.items) {
            if (oldStatus.stockAction === 'COMMIT' && !isReopening) {
              logger.error(`[saleService.updateStatus] Tentativa de reverter status COMMIT na venda ${id}`);
              throw new AppError(`Não é permitido alterar status de um pedido já '${oldStatus.name}' (baixado) sem ser para reabertura ('Em Aberto') ou cancelamento.`, 400);
            }
            await saleService._rollbackStockAction(tx, companyId, userId, sale, item, oldStatus.stockAction, isReopening, rollbackWarehouse);
          }
        }

        // 2. Aplicar ação de estoque NOVA
        const applyWarehouse = newStatus.stockAction !== 'NONE'
          ? await saleService._resolveWarehouse(tx, companyId)
          : null;

        if (sale.items && sale.items.length > 0) {
          logger.info(`[saleService.updateStatus] Aplicando novo estoque para ${sale.items.length} itens (Ação: ${newStatus.stockAction})`);
          for (const item of sale.items) {
            await saleService._applyStockAction(tx, companyId, userId, sale, item, newStatus.stockAction, applyWarehouse);
          }
        }

        logger.info(`[saleService.updateStatus] Atualizando status no banco de dados...`);
        const updatedSale = await tx.sale.update({
          where: { id },
          data: { statusId },
          include: { items: true, client: true, financialRecords: true }
        });

        // 3. Gerar registro financeiro se o novo status for COMMIT
        if (newStatus.stockAction === 'COMMIT') {
          logger.info(`[saleService.updateStatus] Novo status é COMMIT. Verificando financeiro...`);
          const existingFinancial = await tx.financialRecord.findFirst({
            where: { saleId: id, companyId }
          });

          if (!existingFinancial) {
            logger.info(`[saleService.updateStatus] Criando novo financeiro para venda ${id}`);
            // Usar as parcelas discriminadas no pedido se não vierem parcelas novas
            const instData = (installments && installments.length > 0) 
              ? installments 
              : (updatedSale.installmentsData || []);
            
            // Re-injetar dados do cheque que estavam persistidos na venda
            const instToUse = instData.map(inst => ({
              ...inst,
              chequeNumber: inst.chequeNumber || updatedSale.chequeNumber,
              chequeOwner: inst.chequeOwner || updatedSale.chequeOwner,
              chequeDueDate: inst.chequeDueDate || updatedSale.chequeDueDate,
              chequeCustomerId: inst.chequeCustomerId || updatedSale.chequeCustomerId,
              chequeHistory: inst.chequeHistory || updatedSale.chequeHistory
            }));
            
            await financeIntegrationService.generateReceivableFromSale(companyId, updatedSale, instToUse, tx);
          }
        }

        // 4. Atualizar preço base do catálogo de produtos com a última negociação
        if (newStatusName === 'ATENDIDO' || newStatusName === 'FATURADO') {
          logger.info(`[saleService.updateStatus] Status ${newStatusName}: Atualizando preços de catálogo dos produtos.`);
          for (const item of sale.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { price: item.unitPrice }
            });
          }
        }

        logger.info(`[saleService.updateStatus] <<< FIM UPDATE STATUS: Sucesso`);
        return updatedSale;
      }, {
        timeout: 30000 // Aumentando timeout para 30s em transações complexas
      });
    } catch (error) {
      logger.error({
        msg: 'ERRO CRÍTICO NO UPDATE STATUS DE VENDA',
        error: error.message,
        code: error.code,
        stack: error.stack,
        id,
        statusId,
        companyId,
        userId
      });
      throw error;
    }
  },

  /**
   * Gera contas a receber (títulos) para o pedido sem alterar situação nem estoque.
   * Usa parcelas enviadas no corpo; se não enviar, usa installmentsData salvo no pedido
   * ou uma parcela única a partir de paymentMethodId + total.
   */
  async generateReceivables(companyId, userId, id, body = {}) {
    const { installments: bodyInstallments } = body;
    logger.info(`[saleService.generateReceivables] Pedido=${id} company=${companyId} user=${userId}`);

    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, companyId },
      });
      if (!sale) throw new AppError('Venda não encontrada', 404);

      const existingCount = await tx.financialRecord.count({
        where: { saleId: id, companyId },
      });
      if (existingCount > 0) {
        throw new AppError('Este pedido já possui lançamentos em contas a receber vinculados a ele.', 400);
      }

      const rawStored = sale.installmentsData;
      const storedArr = Array.isArray(rawStored) ? rawStored : [];

      let instData =
        Array.isArray(bodyInstallments) && bodyInstallments.length > 0
          ? bodyInstallments
          : storedArr;

      const total = Number(sale.total);
      if (instData.length > 0) {
        const sum = instData.reduce((s, i) => s + Number(i.amount), 0);
        if (Math.abs(sum - total) > 0.01) {
          throw new AppError('A soma das parcelas difere do total do pedido. Ajuste as parcelas ou salve o pedido antes de lançar.', 400);
        }
      }

      if (instData.length === 0 && !sale.paymentMethodId) {
        throw new AppError(
          'Defina a forma de pagamento no pedido ou cadastre parcelas na negociação antes de gerar o financeiro.',
          400
        );
      }

      const detailedSale = await saleService.getById(companyId, id, tx);
      const installmentsWithCheque =
        instData.length > 0
          ? instData.map((inst) => ({
              ...inst,
              chequeNumber: inst.chequeNumber || sale.chequeNumber,
              chequeOwner: inst.chequeOwner || sale.chequeOwner,
              chequeDueDate: inst.chequeDueDate || sale.chequeDueDate,
              chequeCustomerId: inst.chequeCustomerId || sale.chequeCustomerId,
              chequeHistory: inst.chequeHistory || sale.chequeHistory,
            }))
          : [];

      const records = await financeIntegrationService.generateReceivableFromSale(
        companyId,
        detailedSale,
        installmentsWithCheque,
        tx
      );
      if (!records || records.length === 0) {
        throw new AppError(
          'Não foi possível gerar os títulos. Verifique formas de pagamento, valores e datas das parcelas.',
          400
        );
      }

      return saleService.getById(companyId, id, tx);
    }, { timeout: 30000 });
  },
};
