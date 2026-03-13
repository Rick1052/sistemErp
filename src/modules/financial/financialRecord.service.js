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
      if (endDate) where.dueDate.lte = new Date(endDate);
    }

    return prisma.financialRecord.findMany({
      where,
      include: {
        bankAccount: true,
        paymentMethod: true,
        category: true,
        sale: { select: { cod: true } }
      },
      orderBy: { dueDate: 'asc' },
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
      },
    });
    if (!record) throw new AppError('Título financeiro não encontrado', 404);
    return record;
  },

  async create(companyId, data, tx = null) {
    return createWithSequence('financialRecord', companyId, data, tx);
  },

  /**
   * Cria um título já baixado e movimenta o banco (para pagamentos à vista)
   */
  async createAndPay(companyId, data, txExternal = null) {
    const execute = async (tx) => {
      const { bankAccountId, amount, type, description, paymentMethodId, categoryId, saleId, purchaseId } = data;
      
      if (!bankAccountId) throw new AppError('Conta bancária é obrigatória para pagamentos imediatos', 400);

      const pDate = new Date();

      // 1. Criar o Título como PAID
      const record = await this.create(companyId, {
        type,
        description,
        amount,
        dueDate: pDate,
        paymentDate: pDate,
        status: 'PAID',
        bankAccountId,
        paymentMethodId,
        categoryId,
        saleId,
        purchaseId
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

    return txExternal ? execute(txExternal) : prisma.$transaction(execute);
  },

  async update(companyId, id, data) {
    const record = await this.getById(companyId, id);
    if (record.status === 'PAID') {
        throw new AppError('Não é possível editar um título já pago. Estorne o pagamento primeiro.', 400);
    }
    return prisma.financialRecord.update({
      where: { id },
      data,
    });
  },

  async pay(companyId, id, paymentData) {
    const { bankAccountId, paymentDate, amountPaid } = paymentData;

    return prisma.$transaction(async (tx) => {
      const record = await tx.financialRecord.findFirst({
        where: { id, companyId },
      });

      if (!record) throw new AppError('Título não encontrado', 404);
      if (record.status === 'PAID') throw new AppError('Título já está pago', 400);
      if (record.status === 'CANCELLED') throw new AppError('Título está cancelado', 400);

      const amountToUse = amountPaid || record.amount;
      const pDate = paymentDate ? new Date(paymentDate) : new Date();

      // 1. Atualizar o Título
      const updatedRecord = await tx.financialRecord.update({
        where: { id },
        data: {
          status: 'PAID',
          bankAccountId,
          paymentDate: pDate,
          amount: amountToUse, // Caso o valor pago seja diferente do original (parcial não implementado aqui por simplicidade, assume liquidação total)
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
    });
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
    const record = await this.getById(companyId, id);
    if (record.status === 'PAID') {
        throw new AppError('Não é possível excluir um título já pago. Estorne o pagamento primeiro.', 400);
    }
    return prisma.financialRecord.delete({
      where: { id },
    });
  }
};
