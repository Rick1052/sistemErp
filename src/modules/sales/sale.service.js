import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from "../../utils/createWithSequence.js";
import { financeIntegrationService } from "../financial/financeIntegration.service.js";

export const saleService = {
  async list(companyId, { page = 1, limit = 10 }) {
    const skip = (page - 1) * limit;

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where: { companyId } }),
      prisma.sale.findMany({
        where: { companyId },
        include: {
          client: { select: { id: true, name: true, document: true } },
          status: true,
        },
        orderBy: { createdAt: 'desc' },
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

          await this._applyStockAction(tx, companyId, userId, sale, item, saleStatus.stockAction);
        }

        // 4. Generate financial record if status is COMMIT
        if (saleStatus.stockAction === 'COMMIT') {
          const detailedSale = await this.getById(companyId, sale.id, tx);
          await financeIntegrationService.generateReceivableFromSale(companyId, detailedSale, installments, tx);
        }

        return this.getById(companyId, sale.id, tx);
      });
    } catch (error) {
      console.error('ERRO CRÍTICO NA CRIAÇÃO DE VENDA:', error);
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
          await this._rollbackStockAction(tx, companyId, userId, oldSale, item, oldSale.status.stockAction);
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

          await this._applyStockAction(tx, companyId, userId, updatedSale, item, newStatus.stockAction);
        }

        // 7. Generate financial record if status is COMMIT and it wasn't COMMIT before (simplified: always check if it's currently COMMIT)
        // Note: In a more robust system, we would check if it was already generated to avoid duplicates.
        // For now, let's assume if it is COMMIT, we ensure a record exists or create one.
        if (newStatus.stockAction === 'COMMIT') {
          const detailedSale = await this.getById(companyId, updatedSale.id, tx);
          // Check if already has a record to avoid duplicates on edits
          const existingRecord = await tx.financialRecord.findFirst({ where: { saleId: id } });
          if (!existingRecord) {
            await financeIntegrationService.generateReceivableFromSale(companyId, detailedSale, installments, tx);
          }
        }

        return this.getById(companyId, updatedSale.id, tx);
      });
    } catch (error) {
      console.error('ERRO CRÍTICO NA EDIÇÃO DE VENDA:', error);
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
          await this._rollbackStockAction(tx, companyId, userId, sale, item, sale.status.stockAction);
        }

        // Delete items and sale
        await tx.saleItem.deleteMany({ where: { saleId: id } });
        await tx.sale.delete({ where: { id } });

        return { message: 'Venda excluída com sucesso' };
      });
    } catch (error) {
      console.error('ERRO CRÍTICO NA EXCLUSÃO DE VENDA:', error);
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
      return await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id, companyId },
          include: { items: true, status: true }
        });

        if (!sale) throw new AppError('Venda não encontrada', 404);
        if (sale.statusId === statusId) return sale;

        const oldStatus = sale.status;
        const newStatus = await tx.saleStatus.findFirst({
            where: { id: statusId, companyId }
        });
        if (!newStatus) throw new AppError('Novo status não encontrado', 404);

        // Reverse OLD action
        for (const item of sale.items) {
           // SPECIAL CASE: transitioning FROM COMMIT usually isn't allowed without manual reversal
           if (oldStatus.stockAction === 'COMMIT') {
               throw new AppError(`Não é permitido alterar status de um pedido já '${oldStatus.name}' (baixado).`, 400);
           }
           await this._rollbackStockAction(tx, companyId, userId, sale, item, oldStatus.stockAction);
        }

        // Apply NEW action
        for (const item of sale.items) {
            // SPECIAL CASE: If going to COMMIT, we need to handle if it was RESERVE before
            if (newStatus.stockAction === 'COMMIT') {
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                      physicalStock: { decrement: item.quantity },
                      // If it was RESERVE, it was already handled by rollback above (which decremented reserved)
                      // No, wait. Rollback of RESERVE decrements reserved. 
                      // If we go from RESERVE to COMMIT:
                      // 1. Rollback(RESERVE) -> reserved--
                      // 2. Apply(COMMIT) -> physical--
                      // This is CORRECT.
                    }
                  });

                  const warehouse = await tx.warehouse.findFirst({ where: { companyId } });
                  await createWithSequence('stockMovement', companyId, {
                    productId: item.productId,
                    userId,
                    type: 'OUT',
                    quantity: item.quantity,
                    reason: `Venda Pedido ${sale.cod}`,
                    documentRef: String(sale.cod),
                    warehouseId: warehouse.id
                  }, tx);
            } else {
                await this._applyStockAction(tx, companyId, userId, sale, item, newStatus.stockAction);
            }
        }

        const updatedSale = await tx.sale.update({
          where: { id },
          data: { statusId },
          include: { items: true, client: true, financialRecords: true }
        });

        // 3. Generate financial record if new status is COMMIT
        if (newStatus.stockAction === 'COMMIT') {
            await financeIntegrationService.generateReceivableFromSale(companyId, updatedSale, installments, tx);
        }

        return updatedSale;
      });
    } catch (error) {
      console.error('ERRO CRÍTICO NO UPDATE STATUS DE VENDA:', error);
      throw error;
    }
  }
};
