import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';

function mapAccountRow(row) {
  if (!row) return row;
  return {
    ...row,
    type: row.accountKind === 'CASH' ? 'CASH' : 'BANK',
  };
}

export const bankAccountService = {
  async list(companyId) {
    const rows = await prisma.bankAccount.findMany({
      where: { companyId },
      orderBy: { cod: 'asc' },
    });
    return rows.map(mapAccountRow);
  },

  async getById(companyId, id) {
    const account = await prisma.bankAccount.findFirst({
      where: { id, companyId },
    });
    if (!account) throw new AppError('Conta bancária não encontrada', 404);
    return mapAccountRow(account);
  },

  async create(companyId, data) {
    const name = String(data.name ?? '').trim();
    if (!name) throw new AppError('Nome da conta é obrigatório.', 400);

    const initial = Number(data.initialBalance ?? 0);
    if (Number.isNaN(initial)) throw new AppError('Saldo inicial inválido.', 400);

    const accountKind =
      data.type === 'CASH' || data.accountKind === 'CASH' ? 'CASH' : 'BANK';

    const payload = {
      name,
      bankName: data.bankName != null && String(data.bankName).trim() !== ''
        ? String(data.bankName).trim()
        : null,
      accountKind,
      initialBalance: initial,
      currentBalance: initial,
      status: data.status || 'ACTIVE',
    };

    const created = await createWithSequence('bankAccount', companyId, payload);
    return mapAccountRow(created);
  },

  async update(companyId, id, data) {
    await this.getById(companyId, id);

    const patch = {};
    if (data.name !== undefined) patch.name = String(data.name).trim();
    if (data.bankName !== undefined) {
      patch.bankName =
        data.bankName != null && String(data.bankName).trim() !== ''
          ? String(data.bankName).trim()
          : null;
    }
    if (data.type !== undefined || data.accountKind !== undefined) {
      patch.accountKind =
        data.type === 'CASH' || data.accountKind === 'CASH' ? 'CASH' : 'BANK';
    }
    if (data.initialBalance !== undefined) {
      const v = Number(data.initialBalance);
      if (!Number.isNaN(v)) patch.initialBalance = v;
    }
    if (data.status !== undefined) patch.status = data.status;

    if (Object.keys(patch).length === 0) {
      return this.getById(companyId, id);
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: patch,
    });
    return mapAccountRow(updated);
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
    const page = Math.max(1, Number(params.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit ?? 25) || 25));
    const skip = (page - 1) * limit;
    
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

    const [total, transactions] = await Promise.all([
      prisma.bankTransaction.count({ where }),
      prisma.bankTransaction.findMany({
        where,
        // Ordenação cronológica: página 1 = mais antiga
        orderBy: { date: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    // Totais do período (independente da página)
    const [totalInAgg, totalOutAgg] = await Promise.all([
      prisma.bankTransaction.aggregate({
        where: { ...where, type: 'CREDIT' },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { ...where, type: 'DEBIT' },
        _sum: { amount: true },
      }),
    ]);

    const totalIn = Number(totalInAgg?._sum?.amount || 0);
    const totalOut = Number(totalOutAgg?._sum?.amount || 0);

    return {
      initialBalance: Number(account.initialBalance), // Simplified for now
      currentBalance: Number(account.currentBalance),
      totalIn,
      totalOut,
      finalBalance: Number(account.currentBalance),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      lines: transactions.map(t => ({
        date: t.date,
        description: t.description,
        type: t.type === 'CREDIT' ? 'IN' : 'OUT',
        value: Number(t.amount),
        balanceAfter: Number(t.balanceAfter)
      }))
    };
  },

  /**
   * Transferência entre contas da mesma empresa: débito na origem, crédito no destino + lançamentos no extrato.
   */
  async transferBetweenAccounts(companyId, { fromBankAccountId, toBankAccountId, amount, note }) {
    const amt = Number(amount);
    if (fromBankAccountId === toBankAccountId) {
      throw new AppError('A conta de origem e de destino devem ser diferentes.', 400);
    }
    if (!amt || Number.isNaN(amt) || amt <= 0) {
      throw new AppError('Informe um valor válido para a transferência.', 400);
    }

    return prisma.$transaction(async (tx) => {
      const from = await tx.bankAccount.findFirst({
        where: { id: fromBankAccountId, companyId },
      });
      const to = await tx.bankAccount.findFirst({
        where: { id: toBankAccountId, companyId },
      });
      if (!from) throw new AppError('Conta de origem não encontrada.', 404);
      if (!to) throw new AppError('Conta de destino não encontrada.', 404);

      const fromBal = Number(from.currentBalance);
      const newFromBal = fromBal - amt;
      const newToBal = Number(to.currentBalance) + amt;
      const pDate = new Date();
      const baseNote = (note && String(note).trim()) || 'Transferência entre contas';
      const descOut = `${baseNote} → ${to.name}`;
      const descIn = `${baseNote} ← ${from.name}`;

      await tx.bankAccount.update({
        where: { id: from.id },
        data: { currentBalance: newFromBal },
      });
      await tx.bankAccount.update({
        where: { id: to.id },
        data: { currentBalance: newToBal },
      });

      await tx.bankTransaction.create({
        data: {
          companyId,
          bankAccountId: from.id,
          type: 'DEBIT',
          amount: amt,
          date: pDate,
          description: descOut,
          balanceAfter: newFromBal,
        },
      });
      await tx.bankTransaction.create({
        data: {
          companyId,
          bankAccountId: to.id,
          type: 'CREDIT',
          amount: amt,
          date: pDate,
          description: descIn,
          balanceAfter: newToBal,
        },
      });

      return {
        fromAccountId: from.id,
        toAccountId: to.id,
        fromBalance: newFromBal,
        toBalance: newToBal,
        amount: amt,
      };
    }, { timeout: 30000 });
  },
};
