import prisma from '../../database/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';

export const reportController = {
  /**
   * 1. RELATÓRIO DE VENDAS (GET /api/reports/sales)
   */
  getSalesReport: asyncHandler(async (req, res) => {
    const { startDate, endDate, statusId } = req.query;
    const companyId = req.companyId;

    const where = {
      companyId,
      date: {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      },
      statusId: statusId || undefined,
    };

    // Busca os dados das vendas
    const sales = await prisma.sale.findMany({
      where,
      include: {
        client: true,
        status: true,
      },
      orderBy: { date: 'desc' },
    });

    // Agregação otimizada usando Prisma
    const aggregation = await prisma.sale.aggregate({
      where,
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
    });

    res.json({
      data: sales,
      summary: {
        totalSales: aggregation._count.id || 0,
        totalAmount: aggregation._sum.total || 0,
      },
    });
  }),

  /**
   * 2. RELATÓRIO DE CONTAS A PAGAR / RECEBER (GET /api/reports/financial)
   */
  getFinancialReport: asyncHandler(async (req, res) => {
    const { startDate, endDate, type, status } = req.query;
    const companyId = req.companyId;

    if (!type || !['PAYABLE', 'RECEIVABLE'].includes(type)) {
      throw new AppError('O parâmetro "type" (PAYABLE ou RECEIVABLE) é obrigatório.', 400);
    }

    const where = {
      companyId,
      type,
      dueDate: {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      },
      status: status || undefined,
    };

    const records = await prisma.financialRecord.findMany({
      where,
      include: {
        client: true,
        supplier: true,
        category: true,
        bankAccount: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Agrupamento por status usando groupBy para performance
    const groups = await prisma.financialRecord.groupBy({
      by: ['status'],
      where: {
        companyId,
        type,
        dueDate: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const summary = {
      totalPending: 0,
      totalPaid: 0,
      totalOverdue: 0, // Calculado em memória se necessário, ou vindo do status
    };

    groups.forEach((group) => {
      if (group.status === 'PENDING') summary.totalPending = group._sum.amount || 0;
      if (group.status === 'PAID') summary.totalPaid = group._sum.amount || 0;
      // 'CANCELLED' ou outros status não foram solicitados explicitamente no summary, 
      // mas o usuário citou totalOverdue. Geralmente PENDING com dueDate < hoje é overdue.
    });

    // Lógica para Overdue (Atrasado): PENDING e data de vencimento menor que hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueAggregation = await prisma.financialRecord.aggregate({
      where: {
        ...where,
        status: 'PENDING',
        dueDate: {
          lt: today,
          gte: startDate ? new Date(startDate) : undefined,
        },
      },
      _sum: {
        amount: true,
      },
    });
    summary.totalOverdue = overdueAggregation._sum.amount || 0;

    res.json({
      data: records,
      summary,
    });
  }),

  /**
   * 3. RAZÃO BANCÁRIO / EXTRATO (GET /api/reports/bank-statement)
   */
  getBankStatement: asyncHandler(async (req, res) => {
    const { startDate, endDate, bankAccountId } = req.query;
    const companyId = req.companyId;

    if (!bankAccountId) {
      throw new AppError('O parâmetro "bankAccountId" é obrigatório.', 400);
    }

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    // 1. Buscar a conta bancária para pegar o initialBalance
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (!bankAccount || bankAccount.companyId !== companyId) {
      throw new AppError('Conta bancária não encontrada.', 404);
    }

    // 2. Calcular o saldo inicial na startDate
    // Saldo Inicial = Saldo de abertura da conta + (Créditos - Débitos antes da startDate)
    const previousTransactions = await prisma.bankTransaction.aggregate({
      where: {
        bankAccountId,
        date: {
          lt: start,
        },
      },
      _sum: {
        amount: true,
      },
    });
    
    // Note: No sistema, assumimos que TransactionType define se é positivo ou negativo? 
    // Olhando o schema: TransactionType { CREDIT, DEBIT }.
    // Precisamos somar créditos e subtrair débitos.
    
    const creditsBefore = await prisma.bankTransaction.aggregate({
      where: { bankAccountId, type: 'CREDIT', date: { lt: start } },
      _sum: { amount: true }
    });
    const debitsBefore = await prisma.bankTransaction.aggregate({
      where: { bankAccountId, type: 'DEBIT', date: { lt: start } },
      _sum: { amount: true }
    });

    const initialBalanceOnDate = Number(bankAccount.initialBalance) + 
      (Number(creditsBefore._sum.amount || 0) - Number(debitsBefore._sum.amount || 0));

    // 3. Buscar transações no período
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'asc' },
    });

    // 4. Totais do período
    const periodCredits = await prisma.bankTransaction.aggregate({
      where: { bankAccountId, type: 'CREDIT', date: { gte: start, lte: end } },
      _sum: { amount: true }
    });
    const periodDebits = await prisma.bankTransaction.aggregate({
      where: { bankAccountId, type: 'DEBIT', date: { gte: start, lte: end } },
      _sum: { amount: true }
    });

    const totalCredits = Number(periodCredits._sum.amount || 0);
    const totalDebits = Number(periodDebits._sum.amount || 0);
    const finalBalance = initialBalanceOnDate + totalCredits - totalDebits;

    res.json({
      data: transactions,
      summary: {
        initialBalance: initialBalanceOnDate,
        totalCredits,
        totalDebits,
        finalBalance,
      },
    });
  }),

  /**
   * 4. DRE - DEMONSTRAÇÃO DO RESULTADO (GET /api/reports/dre)
   */
  getDREReport: asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const companyId = req.companyId;

    if (!startDate || !endDate) {
      throw new AppError('As datas startDate e endDate são obrigatórias.', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1. Buscar categorias
    const categories = await prisma.financialCategory.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { cod: 'asc' },
    });

    // 2. Buscar registros pagos no período (pela data de pagamento)
    const records = await prisma.financialRecord.findMany({
      where: {
        companyId,
        status: 'PAID',
        paymentDate: {
          gte: start,
          lte: end,
        },
      },
    });

    // 3. Agrupar em memória (Bottom-Up)
    const categoryTotals = {};
    categories.forEach(cat => categoryTotals[cat.id] = 0);

    records.forEach(record => {
      if (record.categoryId && categoryTotals[record.categoryId] !== undefined) {
        const amount = Number(record.amount);
        const category = categories.find(c => c.id === record.categoryId);
        
        if (category.type === 'REVENUE') {
            // Em DRE, Receita é positivo. Se houver devolução (PAYABLE em cat de receita), subtrai.
            categoryTotals[record.categoryId] += (record.type === 'RECEIVABLE' ? amount : -amount);
        } else {
            // Despesa/Custo é positivo no acúmulo da categoria, mas subtrai do lucro final.
            categoryTotals[record.categoryId] += (record.type === 'PAYABLE' ? amount : -amount);
        }
      }
    });

    // Montar árvore
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.id] = {
        id: cat.id,
        cod: cat.cod,
        name: cat.name,
        type: cat.type,
        parentId: cat.parentId,
        total: categoryTotals[cat.id],
        children: []
      };
    });

    const tree = [];
    Object.values(categoryMap).forEach(node => {
      if (node.parentId && categoryMap[node.parentId]) {
        categoryMap[node.parentId].children.push(node);
      } else {
        tree.push(node);
      }
    });

    // Função recursiva para somar totais dos filhos nos pais
    const aggregateTotals = (node) => {
      let childrenSum = 0;
      node.children.forEach(child => {
        childrenSum += aggregateTotals(child);
      });
      node.total += childrenSum;
      return node.total;
    };

    tree.forEach(root => aggregateTotals(root));

    // Cálculos do DRE
    const revenueRoots = tree.filter(n => n.type === 'REVENUE');
    const expenseRoots = tree.filter(n => n.type === 'EXPENSE');

    const totalRevenues = revenueRoots.reduce((acc, n) => acc + n.total, 0);
    const totalExpenses = expenseRoots.reduce((acc, n) => acc + n.total, 0);
    const netProfit = totalRevenues - totalExpenses;

    res.json({
      summary: {
        totalRevenues,
        totalExpenses,
        netProfit
      },
      tree
    });
  }),

  /**
   * 5. RELATÓRIO DE CHEQUES (GET /api/reports/cheques)
   */
  getChequesReport: asyncHandler(async (req, res) => {
    const { startDate, endDate, status, clientName } = req.query;
    const companyId = req.companyId;

    const where = {
      companyId,
      chequeNumber: { not: null },
    };

    if (startDate || endDate) {
      where.date = {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      };
    }

    if (status) {
      where.status = status;
    }

    if (clientName) {
      where.OR = [
        { chequeCustomer: { name: { contains: clientName, mode: 'insensitive' } } },
        { client: { name: { contains: clientName, mode: 'insensitive' } } }
      ];
    }

    const cheques = await prisma.financialRecord.findMany({
      where,
      include: {
        chequeCustomer: true,
        client: true,
        sale: { select: { cod: true } },
      },
      orderBy: { date: 'desc' },
    });

    const summary = await prisma.financialRecord.aggregate({
      where,
      _count: { id: true },
      _sum: { amount: true },
    });

    res.json({
      data: cheques,
      summary: {
        totalCheques: summary._count.id || 0,
        totalAmount: summary._sum.amount || 0,
      },
    });
  }),
};
