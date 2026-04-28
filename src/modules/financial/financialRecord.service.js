import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';
import { parseDateInput } from '../../utils/date.js';

export const financialRecordService = {
  async list(companyId, filters = {}) {
    const { type, status, startDate, endDate, categoryId, bankAccountId } = filters;
    const page = Math.max(1, Number(filters.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit ?? 25) || 25));
    const skip = (page - 1) * limit;
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

    const [total, data] = await Promise.all([
      prisma.financialRecord.count({ where }),
      prisma.financialRecord.findMany({
        where,
        include: {
          bankAccount: { select: { id: true, name: true } },
          paymentMethod: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          sale: { select: { cod: true } },
          client: { select: { id: true, name: true, document: true } },
          supplier: { select: { id: true, name: true, document: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { data, total, page, limit };
  },

  async getById(companyId, id) {
    const record = await prisma.financialRecord.findFirst({
      where: { id, companyId },
      include: {
        bankAccount: true,
        paymentMethod: true,
        category: true,
        transactions: true,
        payments: {
          include: {
            bankAccount: true,
            paymentMethod: true,
          },
          orderBy: { paymentDate: 'desc' },
        },
        client: true,
        supplier: true
      },
    });
    if (!record) throw new AppError('Título financeiro não encontrado', 404);
    return record;
  },

  async create(companyId, data, tx = null) {
    try {
      if (data.chequeHistory) {
        const timestamp = new Date().toLocaleString('pt-BR', { 
          day: '2-digit', month: '2-digit', year: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        });
        data.chequeHistory = `[${timestamp}] - ${data.chequeHistory}`;
      }
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

      const pDate = parseDateInput(date);
      if (isNaN(pDate.getTime())) throw new AppError('Data inválida', 400);

      // 1. Criar o Título como PAID
      const record = await this.create(companyId, {
        type,
        description,
        amount,
        date: pDate,
        dueDate: pDate,
        paymentDate: pDate,
        status: 'PAID',
        paidAmount: amount,
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
      const payment = await tx.financialRecordPayment.create({
        data: {
          companyId,
          financialRecordId: record.id,
          amount,
          paymentDate: pDate,
          bankAccountId,
          paymentMethodId,
          note: 'Pagamento imediato',
        },
      });

      await tx.bankTransaction.create({
        data: {
          companyId,
          bankAccountId,
          financialRecordId: record.id,
          financialRecordPaymentId: payment.id,
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
    if (record.status === 'PAID' || record.status === 'PARTIALLY_PAID') {
      // Se a única chave sendo atualizada for o chequeHistory, liberar.
      const keys = Object.keys(data).filter(k => data[k] !== undefined);
      const isOnlyHistory = keys.length === 1 && keys[0] === 'chequeHistory';
      if (!isOnlyHistory) {
        throw new AppError('Não é possível editar informações principais de um título já baixado. Estorne os pagamentos primeiro.', 400);
      }
    }

    if (data.chequeHistory) {
      const timestamp = new Date().toLocaleString('pt-BR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
      const newEntry = `[${timestamp}] - ${data.chequeHistory}`;
      data.chequeHistory = record.chequeHistory 
        ? `${newEntry}\n${record.chequeHistory}` 
        : newEntry;
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
      note,
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

      if (!bankAccountId) throw new AppError('Conta bancária é obrigatória', 400);
      if (!paymentMethodId) throw new AppError('Forma de pagamento é obrigatória', 400);

      const totalAmount = Number(record.amount);
      const alreadyPaid = Number(record.paidAmount ?? 0);
      const remaining = totalAmount - alreadyPaid;

      const amountToUseRaw = amountPaid ?? remaining;
      const amountToUse = Number(amountToUseRaw);
      if (!Number.isFinite(amountToUse) || amountToUse <= 0) {
        throw new AppError('Valor da baixa inválido', 400);
      }
      if (amountToUse > remaining + 0.000001) {
        throw new AppError('Valor da baixa não pode ser maior que o saldo em aberto', 400);
      }

      const pDate = parseDateInput(paymentDate);
      if (isNaN(pDate.getTime())) throw new AppError('Data de baixa inválida', 400);

      // 1. Criar a baixa (pagamento)
      const payment = await tx.financialRecordPayment.create({
        data: {
          companyId,
          financialRecordId: id,
          amount: amountToUse,
          paymentDate: pDate,
          bankAccountId,
          paymentMethodId,
          note: note ?? null,
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
          financialRecordPaymentId: payment.id,
          type: isRevenue ? 'CREDIT' : 'DEBIT',
          amount: amountToUse,
          date: pDate,
          description: `Baixa (${amountToUse.toFixed(2)}): ${record.description}`,
          balanceAfter: newBalance,
        },
      });

      // 4. Atualizar o título (paidAmount/status/paymentDate e campos de cheque)
      const newPaidAmount = alreadyPaid + amountToUse;
      const isFullyPaid = newPaidAmount >= totalAmount - 0.000001;

      const updatedRecord = await tx.financialRecord.update({
        where: { id },
        data: {
          status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidAmount: newPaidAmount,
          paymentDate: pDate, // última baixa
          bankAccountId: bankAccountId || record.bankAccountId,
          paymentMethodId: paymentMethodId || record.paymentMethodId,
          chequeNumber: chequeNumber || record.chequeNumber,
          chequeOwner: chequeOwner || record.chequeOwner,
          chequeDueDate: chequeDueDate
            ? new Date(typeof chequeDueDate === 'string' && chequeDueDate.length === 10 ? `${chequeDueDate}T12:00:00Z` : chequeDueDate)
            : record.chequeDueDate,
          chequeCustomerId: chequeCustomerId || record.chequeCustomerId,
          chequeHistory: chequeHistory !== undefined ? chequeHistory : record.chequeHistory,
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
