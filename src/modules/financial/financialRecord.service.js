import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';
import { parseDateInput } from '../../utils/date.js';
import { clientCreditService, round2 } from '../clientCredit/clientCredit.service.js';

/** Meio centavo: tolerância nas comparações de valores monetários */
const EPSILON = 0.005;

const formatBRL = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

export const financialRecordService = {
  async list(companyId, filters = {}) {
    const { type, status, startDate, endDate, categoryId, bankAccountId, search } = filters;
    const page = Math.max(1, Number(filters.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit ?? 25) || 25));
    const skip = (page - 1) * limit;
    const where = { companyId };

    if (type) where.type = type;
    if (status) {
      const raw = String(status).trim();
      if (raw.includes(',')) {
        const values = raw.split(',').map((v) => v.trim()).filter(Boolean);
        if (values.length === 1) where.status = values[0];
        else if (values.length > 1) where.status = { in: values };
      } else {
        where.status = status;
      }
    }
    if (categoryId) where.categoryId = categoryId;
    if (bankAccountId) where.bankAccountId = bankAccountId;

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) {
        const d = parseDateInput(startDate);
        d.setUTCHours(0, 0, 0, 0);
        where.dueDate.gte = d;
      }
      if (endDate) {
        const d = parseDateInput(endDate);
        d.setUTCHours(23, 59, 59, 999);
        where.dueDate.lte = d;
      }
    }

    if (search && String(search).trim()) {
      const s = String(search).trim();
      const onlyDigits = s.replace(/\D/g, '');
      const cod = Number(s);
      const hasCod = Number.isFinite(cod) && !Number.isNaN(cod);

      where.OR = [
        { description: { contains: s, mode: 'insensitive' } },
        { chequeNumber: { contains: s, mode: 'insensitive' } },
        { client: { is: { name: { contains: s, mode: 'insensitive' } } } },
        { supplier: { is: { name: { contains: s, mode: 'insensitive' } } } },
        { client: { is: { document: { contains: onlyDigits || s, mode: 'insensitive' } } } },
        { supplier: { is: { document: { contains: onlyDigits || s, mode: 'insensitive' } } } },
      ];

      if (hasCod) {
        where.OR.push({ cod });
        // procurar pelo número do pedido (venda) também
        where.OR.push({ sale: { is: { cod } } });
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

  /**
   * Baixa (total ou parcial) de um título.
   *
   * Regra 1 do crédito em conta: se o valor recebido for MAIOR que o saldo em aberto
   * de um título a receber com cliente identificado, o título é quitado pelo que falta
   * e o excedente vira crédito em conta do cliente — tudo na mesma transação.
   */
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
        include: { sale: { select: { id: true, cod: true, clientId: true } } },
      });

      if (!record) throw new AppError('Título não encontrado', 404);
      if (record.status === 'PAID') throw new AppError('Título já está pago', 400);
      if (record.status === 'CANCELLED') throw new AppError('Título está cancelado', 400);

      if (!bankAccountId) throw new AppError('Conta bancária é obrigatória', 400);
      if (!paymentMethodId) throw new AppError('Forma de pagamento é obrigatória', 400);

      const totalAmount = Number(record.amount);
      const alreadyPaid = Number(record.paidAmount ?? 0);
      const remaining = round2(totalAmount - alreadyPaid);

      const amountToUseRaw = amountPaid ?? remaining;
      const amountToUse = round2(amountToUseRaw);
      if (!Number.isFinite(amountToUse) || amountToUse <= 0) {
        throw new AppError('Valor da baixa inválido', 400);
      }

      // Recebimento acima do saldo em aberto: a diferença vira crédito do cliente.
      const isRevenue = record.type === 'RECEIVABLE';
      const creditClientId = record.clientId || record.sale?.clientId || null;
      let appliedAmount = amountToUse;
      let creditAmount = 0;

      if (amountToUse > remaining + EPSILON) {
        if (!isRevenue) {
          throw new AppError('Valor da baixa não pode ser maior que o saldo em aberto', 400);
        }
        if (!creditClientId) {
          throw new AppError(
            'Valor recebido maior que o saldo em aberto. Vincule um cliente ao título para que o excedente vire crédito em conta.',
            400,
          );
        }
        appliedAmount = remaining;
        creditAmount = round2(amountToUse - remaining);
      }

      const pDate = parseDateInput(paymentDate);
      if (isNaN(pDate.getTime())) throw new AppError('Data de baixa inválida', 400);

      // 1. Criar a baixa (pagamento). `amount` é o que entrou no título;
      //    `creditGenerated` é o excedente — juntos são o valor que entrou no banco.
      const payment = await tx.financialRecordPayment.create({
        data: {
          companyId,
          financialRecordId: id,
          amount: appliedAmount,
          creditGenerated: creditAmount,
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

      const balanceChange = isRevenue ? amountToUse : -amountToUse;
      const newBalance = Number(bankAccount.currentBalance) + Number(balanceChange);

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: newBalance },
      });

      // 3. Gerar Transação Bancária (Extrato) — sempre pelo valor total recebido
      await tx.bankTransaction.create({
        data: {
          companyId,
          bankAccountId,
          financialRecordId: id,
          financialRecordPaymentId: payment.id,
          type: isRevenue ? 'CREDIT' : 'DEBIT',
          amount: amountToUse,
          date: pDate,
          description: creditAmount > 0
            ? `Baixa (${appliedAmount.toFixed(2)}) + crédito em conta (${creditAmount.toFixed(2)}): ${record.description}`
            : `Baixa (${appliedAmount.toFixed(2)}): ${record.description}`,
          balanceAfter: newBalance,
        },
      });

      // 3.1 Excedente vira crédito do cliente (Regra 1)
      if (creditAmount > 0) {
        await clientCreditService.gerarCredito({
          companyId,
          clientId: creditClientId,
          amount: creditAmount,
          // Só vincula o pedido se ele for do mesmo cliente que recebe o crédito
          saleId: record.sale?.clientId === creditClientId ? record.saleId : null,
          financialRecordId: record.id,
          financialRecordPaymentId: payment.id,
          userId: paymentData.userId || null,
          note: `Pagamento a maior na baixa do título #${record.cod} (${record.description})`,
        }, tx);
      }

      // 4. Atualizar o título (paidAmount/status/paymentDate e campos de cheque)
      const newPaidAmount = round2(alreadyPaid + appliedAmount);
      const isFullyPaid = newPaidAmount >= totalAmount - EPSILON;

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
            ? parseDateInput(chequeDueDate)
            : record.chequeDueDate,
          chequeCustomerId: chequeCustomerId || record.chequeCustomerId,
          chequeHistory: chequeHistory !== undefined ? chequeHistory : record.chequeHistory,
        },
      });

      // `creditGenerated` deixa o controller/UI avisarem que sobrou saldo para o cliente
      return { ...updatedRecord, creditGenerated: creditAmount };
    }, { timeout: 30000 });
  },

  /**
   * Estorna baixas de um título: apaga o lançamento do extrato, devolve o saldo
   * da conta bancária, remove a baixa e recalcula status/paidAmount do título.
   *
   * Sem `paymentId`, estorna todas as baixas. O título volta a PENDING (ou
   * PARTIALLY_PAID, se sobrar alguma baixa) e volta a ser editável/excluível.
   *
   * Se a baixa tinha gerado crédito em conta (recebimento a maior), o crédito é
   * retirado do cliente no mesmo movimento. Se esse crédito já tiver sido gasto,
   * o estorno é bloqueado — não existe saldo negativo (Regra 11).
   */
  async reverse(companyId, id, paymentId = null, userId = null) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.financialRecord.findFirst({
        where: { id, companyId },
        include: {
          payments: true,
          sale: { select: { id: true, cod: true, clientId: true } },
        },
      });

      if (!record) throw new AppError('Título não encontrado', 404);
      if (record.status === 'CANCELLED') throw new AppError('Título está cancelado', 400);
      if (record.payments.length === 0) throw new AppError('Este título não possui baixas para estornar', 400);

      const aEstornar = paymentId
        ? record.payments.filter((p) => p.id === paymentId)
        : record.payments;

      if (aEstornar.length === 0) throw new AppError('Baixa não encontrada neste título', 400);

      const isRevenue = record.type === 'RECEIVABLE';
      const creditClientId = record.clientId || record.sale?.clientId || null;

      // Antes de mexer em qualquer coisa: o crédito gerado por estas baixas ainda
      // está disponível? Se já foi usado em outro pedido, o estorno não pode seguir.
      const creditToUndo = round2(
        aEstornar.reduce((soma, p) => soma + Number(p.creditGenerated ?? 0), 0),
      );
      if (creditToUndo > EPSILON) {
        const client = await tx.client.findFirst({
          where: { id: creditClientId, companyId },
          select: { creditBalance: true },
        });
        const available = round2(client?.creditBalance ?? 0);
        if (available + EPSILON < creditToUndo) {
          throw new AppError(
            `Esta baixa gerou ${formatBRL(creditToUndo)} de crédito em conta e o cliente já utilizou parte dele (saldo atual: ${formatBRL(available)}). ` +
            'Estorne primeiro o uso do crédito nos pedidos envolvidos.',
            400,
          );
        }
      }

      for (const payment of aEstornar) {
        // 1. Apagar o extrato gerado por esta baixa (o BankTransaction referencia
        //    a baixa, então precisa sair antes dela).
        await tx.bankTransaction.deleteMany({
          where: { financialRecordPaymentId: payment.id },
        });

        // 2. Retirar o crédito que esta baixa tinha gerado, antes de apagá-la
        //    (as movimentações referenciam a baixa).
        const creditGerado = round2(payment.creditGenerated ?? 0);
        if (creditGerado > EPSILON) {
          await tx.clientCredit.updateMany({
            where: { financialRecordPaymentId: payment.id },
            data: { financialRecordPaymentId: null },
          });
          await clientCreditService.estornarMovimentacao({
            companyId,
            clientId: creditClientId,
            amount: -creditGerado,
            financialRecordId: record.id,
            userId,
            note: `Estorno da baixa do título #${record.cod}: crédito em conta desfeito`,
          }, tx);
        }

        // 3. Devolver o saldo bancário: entrou o valor da baixa + o excedente que
        //    virou crédito, então o estorno tira os dois.
        const bankAccount = await tx.bankAccount.findUnique({
          where: { id: payment.bankAccountId },
        });
        if (bankAccount) {
          const valor = round2(Number(payment.amount) + creditGerado);
          await tx.bankAccount.update({
            where: { id: bankAccount.id },
            data: {
              currentBalance: Number(bankAccount.currentBalance) + (isRevenue ? -valor : valor),
            },
          });
        }

        // 4. Remover a baixa
        await tx.financialRecordPayment.delete({ where: { id: payment.id } });
      }

      // 4. Recalcular o título a partir do que sobrou
      const restantes = record.payments.filter((p) => !aEstornar.some((e) => e.id === p.id));
      const paidAmount = restantes.reduce((soma, p) => soma + Number(p.amount), 0);
      const total = Number(record.amount);

      let status = 'PENDING';
      if (paidAmount >= total - 0.000001) status = 'PAID';
      else if (paidAmount > 0) status = 'PARTIALLY_PAID';

      const ultima = restantes
        .slice()
        .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];

      return tx.financialRecord.update({
        where: { id },
        data: {
          status,
          paidAmount,
          paymentDate: ultima ? ultima.paymentDate : null,
        },
      });
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

      if (record.status === 'PAID' || record.status === 'PARTIALLY_PAID') {
        // PARTIALLY_PAID caía no delete e estourava erro de chave estrangeira
        // (500) por causa das baixas já lançadas. Bloqueia com a mesma mensagem.
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
