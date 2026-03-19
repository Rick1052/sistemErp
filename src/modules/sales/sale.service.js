import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from "../../utils/createWithSequence.js";
import { financeIntegrationService } from "../financial/financeIntegration.service.js";
import logger from '../../utils/logger.js';

export const saleService = {
  async list(companyId, { page = 1, limit = 10, startDate, endDate }) {
    const skip = (page - 1) * limit;
    const where = { companyId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, document: true } },
          status: true,
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      sales,
      meta: {
        total,
        page,
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
    const { items, discount = 0, freight = 0, statusId, installments = [], ...saleData } = data;

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
          subtotal,
          discount,
          freight,
          total,
        }, tx);

        // 3. Create items and handle stock action
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

          await saleService._applyStockAction(tx, companyId, userId, sale, item, saleStatus.stockAction);
        }

        // 4. Generate financial record if status is COMMIT
        if (saleStatus.stockAction === 'COMMIT') {
          logger.info(`[saleService.create] Gerando financeiro para venda recém-criada ${sale.id}`);
          const detailedSale = await saleService.getById(companyId, sale.id, tx);
          await financeIntegrationService.generateReceivableFromSale(companyId, detailedSale, installments, tx);
        }

        return saleService.getById(companyId, sale.id, tx);
      }, { timeout: 30000 });
    } catch (error) {
      logger.error('ERRO CRÍTICO NA CRIAÇÃO DE VENDA:', error);
      throw error;
    }
  },

  async update(companyId, userId, id, data) {
    const { items, discount = 0, freight = 0, statusId, installments = [], ...saleData } = data;

    try {
      return await prisma.$transaction(async (tx) => {
        const oldSale = await tx.sale.findFirst({
          where: { id, companyId },
          include: { items: true, status: true }
        });
        if (!oldSale) throw new AppError('Venda não encontrada', 404);

        // 1. Rollback old stock actions
        for (const item of oldSale.items) {
          await saleService._rollbackStockAction(tx, companyId, userId, oldSale, item, oldSale.status.stockAction);
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
            subtotal,
            discount,
            freight,
            total,
          }
        });

        // 6. Create new items and apply new stock actions
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

          await saleService._applyStockAction(tx, companyId, userId, updatedSale, item, newStatus.stockAction);
        }

        // 7. Generate financial record if status is COMMIT and it wasn't COMMIT before
        if (newStatus.stockAction === 'COMMIT') {
          const detailedSale = await saleService.getById(companyId, updatedSale.id, tx);
          // Check if already has a record to avoid duplicates on edits
          const existingRecord = await tx.financialRecord.findFirst({ where: { saleId: id } });
          if (!existingRecord) {
            await financeIntegrationService.generateReceivableFromSale(companyId, detailedSale, installments, tx);
          }
        }

        return saleService.getById(companyId, updatedSale.id, tx);
      }, { timeout: 30000 });
    } catch (error) {
      logger.error('ERRO CRÍTICO NA EDIÇÃO DE VENDA:', error);
      throw error;
    }
  },

  async delete(companyId, userId, id) {
    try {
      return await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id, companyId },
          include: { items: true, status: true }
        });
        if (!sale) throw new AppError('Venda não encontrada', 404);

        // Block if COMMIT
        if (sale.status.stockAction === 'COMMIT') {
          throw new AppError('Não é possível excluir um pedido já faturado. Faça uma nota de devolução', 400);
        }

        // Rollback stock actions (RESERVE)
        for (const item of sale.items) {
          await saleService._rollbackStockAction(tx, companyId, userId, sale, item, sale.status.stockAction);
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
  async _applyStockAction(tx, companyId, userId, sale, item, action) {
    if (action === 'NONE') return;

    const warehouse = await tx.warehouse.findFirst({ where: { companyId } });
    if (!warehouse) throw new AppError('Depósito não encontrado.', 400);

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
        warehouseId: warehouse.id
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
        warehouseId: warehouse.id
      }, tx);
    }
  },

  async _rollbackStockAction(tx, companyId, userId, sale, item, action) {
    if (action === 'NONE') return;

    const warehouse = await tx.warehouse.findFirst({ where: { companyId } });
    if (!warehouse) throw new AppError('Depósito não encontrado.', 400);

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
        warehouseId: warehouse.id
      }, tx);
    }
    // COMMIT rollback is generally NOT allowed via DELETE/EDIT in simple flows (should use returns)
    // But for EDIT flow, we might need a more complex logic if changing FROM commit.
    // However, the rule says "Block DELETE if COMMIT". Let's assume EDIT also blocks if COMMIT for now to be safe.
    if (action === 'COMMIT') {
      throw new AppError('Não é possível editar ou excluir um pedido já faturado/com estoque baixado.', 400);
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

        // 1. Reverter ação de estoque ANTIGA
        if (sale.items && sale.items.length > 0) {
          logger.info(`[saleService.updateStatus] Revertendo estoque para ${sale.items.length} itens (Ação: ${oldStatus.stockAction})`);
          for (const item of sale.items) {
            if (oldStatus.stockAction === 'COMMIT') {
              logger.error(`[saleService.updateStatus] Tentativa de reverter status COMMIT na venda ${id}`);
              throw new AppError(`Não é permitido alterar status de um pedido já '${oldStatus.name}' (baixado).`, 400);
            }
            await saleService._rollbackStockAction(tx, companyId, userId, sale, item, oldStatus.stockAction);
          }
        }

        // 2. Aplicar ação de estoque NOVA
        if (sale.items && sale.items.length > 0) {
          logger.info(`[saleService.updateStatus] Aplicando novo estoque para ${sale.items.length} itens (Ação: ${newStatus.stockAction})`);
          for (const item of sale.items) {
            await saleService._applyStockAction(tx, companyId, userId, sale, item, newStatus.stockAction);
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
            await financeIntegrationService.generateReceivableFromSale(companyId, updatedSale, installments, tx);
          }
        }

        logger.info(`[saleService.updateStatus] <<< FIM UPDATE STATUS: Sucesso`);
        return updatedSale;
      }, {
        timeout: 30000 // Aumentando timeout para 30s em transações complexas
      });
    } catch (error) {
      logger.error('ERRO CRÍTICO NO UPDATE STATUS DE VENDA:', error);
      throw error;
    }
  }
};
