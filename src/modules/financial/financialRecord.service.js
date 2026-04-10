import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';

export const financialRecordService = {
  async list(companyId, filters = {}) {
    const { type, status, startDate, endDate, categoryId, bankAccountId } = filters;
    const where = { companyId };

    if (type) where.type = type;
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (bankAccountId) where.bankAccountId = bankAccountId;

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        where.dueDate.lte = d;
      }
    }

    return prisma.financialRecord.findMany({
      where,
      include: {
        bankAccount: true,
        paymentMethod: true,
        category: true,
        sale: { select: { cod: true } },
        client: true,
        supplier: true
      },
      orderBy: { date: 'desc' },
    });
  },

  async getById(companyId, id) {
    const record = await prisma.financialRecord.findFirst({
      where: { id, companyId },
      include: {
        bankAccount: true,
        paymentMethod: true,
        category: true,
        transactions: true,
        client: true,
        supplier: true
      },
    });
    if (!record) throw new AppError('Título financeiro não encontrado', 404);
    return record;
  },

  async create(companyId, data, tx = null) {
    try {
      return await createWithSequence('financialRecord', companyId, data, tx);
    } catch (error) {
      console.error('ERRO AO CRIAR LANÇAMENTO FINANCEIRO:', error);
      throw error;
    }
  },

  /**
   * Cria um título já baixado e movimenta o banco (para pagamentos à vista)
   */
  async createAndPay(companyId, data, txExternal = null) {
    const execute = async (tx) => {
      const { 
        bankAccountId, 
        amount, 
        type, 
        description, 
        paymentMethodId, 
        categoryId, 
        saleId, 
        purchaseId, 
        date,
        chequeNumber,
        chequeOwner,
        chequeDueDate,
        chequeCustomerId,
        chequeHistory
      } = data;

      if (!bankAccountId) throw new AppError('Conta bancária é obrigatória para pagamentos imediatos', 400);

      const pDate = date ? new Date(date) : new Date();

      // 1. Criar o Título como PAID
      const record = await this.create(companyId, {
        type,
        description,
        amount,
        date: pDate,
        dueDate: pDate,
        paymentDate: pDate,
        status: 'PAID',
        bankAccountId,
        paymentMethodId,
        categoryId,
        saleId,
        purchaseId,
        chequeNumber,
        chequeOwner,
        chequeDueDate,
        chequeCustomerId,
        chequeHistory
      }, tx);

      // 2. Atualizar Saldo da Conta
      const bankAccount = await tx.bankAccount.findUnique({ where: { id: bankAccountId } });
      if (!bankAccount) throw new AppError('Conta bancária não encontrada', 404);

      const isRevenue = type === 'RECEIVABLE';
      const balanceChange = isRevenue ? amount : -amount;
      const newBalance = Number(bankAccount.currentBalance) + Number(balanceChange);

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: newBalance },
      });

      // 3. Registrar Transação
      await tx.bankTransaction.create({
        data: {
          companyId,
          bankAccountId,
          financialRecordId: record.id,
          type: isRevenue ? 'CREDIT' : 'DEBIT',
          amount,
          date: pDate,
          description: `Pagamento imediato: ${description}`,
          balanceAfter: newBalance,
        },
      });

      return record;
    };

    return txExternal ? execute(txExternal) : prisma.$transaction(execute, { timeout: 30000 });
  },

  async update(companyId, id, data) {
    const record = await this.getById(companyId, id);
    if (record.status === 'PAID') {
      // Se a única chave sendo atualizada for o chequeHistory, liberar.
      const keys = Object.keys(data).filter(k => data[k] !== undefined);
      const isOnlyHistory = keys.length === 1 && keys[0] === 'chequeHistory';
      if (!isOnlyHistory) {
        throw new AppError('Não é possível editar informações principais de um título já pago. Estorne o pagamento primeiro.', 400);
      }
    }
    return prisma.financialRecord.update({
      where: { id },
      data,
    });
  },

  async pay(companyId, id, paymentData) {
    const { 
      bankAccountId, 
      paymentDate, 
      amountPaid, 
      paymentMethodId,
      chequeNumber,
      chequeOwner,
      chequeDueDate,
      chequeCustomerId,
      chequeHistory
    } = paymentData;

    return prisma.$transaction(async (tx) => {
      const record = await tx.financialRecord.findFirst({
        where: { id, companyId },
      });

      if (!record) throw new AppError('Título não encontrado', 404);
      if (record.status === 'PAID') throw new AppError('Título já está pago', 400);
      if (record.status === 'CANCELLED') throw new AppError('Título está cancelado', 400);

      const amountToUse = amountPaid ?? record.amount;
      const pDate = paymentDate ? new Date(paymentDate) : new Date();

      // 1. Atualizar o Título
      const updatedRecord = await tx.financialRecord.update({
        where: { id },
        data: {
          status: 'PAID',
          bankAccountId,
          paymentDate: pDate,
          amount: amountToUse,
          paymentMethodId: paymentMethodId || record.paymentMethodId,
          chequeNumber: chequeNumber || record.chequeNumber,
          chequeOwner: chequeOwner || record.chequeOwner,
          chequeDueDate: chequeDueDate ? new Date(typeof chequeDueDate === 'string' && chequeDueDate.length === 10 ? `${chequeDueDate}T12:00:00Z` : chequeDueDate) : record.chequeDueDate,
          chequeCustomerId: chequeCustomerId || record.chequeCustomerId,
          chequeHistory: chequeHistory !== undefined ? chequeHistory : record.chequeHistory,
        },
      });

      // 2. Buscar/Atualizar a Conta Bancária
      const bankAccount = await tx.bankAccount.findUnique({
        where: { id: bankAccountId },
      });
      if (!bankAccount) throw new AppError('Conta bancária não encontrada', 404);

      const isRevenue = record.type === 'RECEIVABLE';
      const balanceChange = isRevenue ? amountToUse : -amountToUse;
      const newBalance = Number(bankAccount.currentBalance) + Number(balanceChange);

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: newBalance },
      });

      // 3. Gerar Transação Bancária (Extrato)
      await tx.bankTransaction.create({
        data: {
          companyId,
          bankAccountId,
          financialRecordId: id,
          type: isRevenue ? 'CREDIT' : 'DEBIT',
          amount: amountToUse,
          date: pDate,
          description: `Baixa de título: ${record.description}`,
          balanceAfter: newBalance,
        },
      });

      return updatedRecord;
    }, { timeout: 30000 });
  },

  async cancel(companyId, id) {
    const record = await this.getById(companyId, id);
    if (record.status === 'PAID') {
      throw new AppError('Não é possível cancelar um título já pago. Estorne o pagamento primeiro.', 400);
    }
    return prisma.financialRecord.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  },


  async delete(companyId, id) {
    try {
      console.log(`[financialRecordService.delete] Tentando excluir ID: ${id}, Company: ${companyId}`);
      
      const record = await prisma.financialRecord.findFirst({
        where: { id, companyId },
        include: { 
          sale: { 
            include: { status: true } 
          } 
        }
      });

      if (!record) {
        console.warn(`[financialRecordService.delete] Registro não encontrado: ${id}`);
        throw new AppError('Título não encontrado', 404);
      }

      console.log(`[financialRecordService.delete] Registro encontrado:`, {
        status: record.status,
        hasSale: !!record.saleId,
        saleStatus: record.sale?.status?.name
      });

      if (record.status === 'PAID') {
        throw new AppError('Estorne o pagamento antes de excluir', 400);
      }

      // Removemos a validação de status da venda para permitir o fluxo: 
      // 1. Deletar a conta gerada
      // 2. Deletar o pedido
      
      if (record.purchaseId) {
        throw new AppError('Não é possível excluir título vinculado a uma compra sistêmica estrutural de forma avulsa.', 400);
      }

      const result = await prisma.financialRecord.delete({
        where: { id },
      });
      
      console.log(`[financialRecordService.delete] Excluído com sucesso: ${id}`);
      return result;
    } catch (error) {
      console.error(`[financialRecordService.delete] Erro ao excluir ${id}:`, error);
      throw error;
    }
  }
};
