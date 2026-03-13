import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';

export const bankAccountService = {
  async list(companyId) {
    return prisma.bankAccount.findMany({
      where: { companyId },
      orderBy: { cod: 'asc' },
    });
  },

  async getById(companyId, id) {
    const account = await prisma.bankAccount.findFirst({
      where: { id, companyId },
    });
    if (!account) throw new AppError('Conta bancária não encontrada', 404);
    return account;
  },

  async create(companyId, data) {
    const accountData = {
      ...data,
      currentBalance: data.initialBalance || 0
    };
    return createWithSequence('bankAccount', companyId, accountData);
  },

  async update(companyId, id, data) {
    await this.getById(companyId, id);
    return prisma.bankAccount.update({
      where: { id },
      data,
    });
  },

  async delete(companyId, id) {
    await this.getById(companyId, id);
    
    // Check if account has transactions
    const hasTransactions = await prisma.bankTransaction.findFirst({
      where: { bankAccountId: id }
    });
    if (hasTransactions) {
        throw new AppError('Não é possível excluir uma conta que já possui movimentações.', 400);
    }

    return prisma.bankAccount.delete({
      where: { id },
    });
  },

  async getStatement(companyId, id, params = {}) {
    const { month, year } = params;
    
    const account = await this.getById(companyId, id);
    
    const where = {
      bankAccountId: id,
      companyId: companyId
    };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      where.date = {
        gte: startDate,
        lte: endDate
      };
    }

    const transactions = await prisma.bankTransaction.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    // Calculate totals for the period
    const totalIn = transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);
      
    const totalOut = transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      initialBalance: Number(account.initialBalance), // Simplified for now
      currentBalance: Number(account.currentBalance),
      totalIn,
      totalOut,
      finalBalance: Number(account.currentBalance),
      lines: transactions.map(t => ({
        date: t.date,
        description: t.description,
        type: t.type === 'CREDIT' ? 'IN' : 'OUT',
        value: Number(t.amount),
        balanceAfter: Number(t.balanceAfter)
      }))
    };
  }
};
