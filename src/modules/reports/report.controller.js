import prisma from '../../database/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { productSalesReportService } from './productSalesReport.service.js';
import { salesReportService } from './salesReport.service.js';
import { commercialSalesReportService } from './commercialSalesReport.service.js';

export const reportController = {
  /**
   * 1. RELATÓRIO DE VENDAS (GET /api/reports/sales)
   */
  getSalesReport: asyncHandler(async (req, res) => {
    const result = await salesReportService.getFullReport(req.companyId, req.query);
    res.json(result);
  }),

  getCommercialSalesReport: asyncHandler(async (req, res) => {
    const result = await commercialSalesReportService.getFullReport(req.companyId, req.query);
    res.json(result);
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
        lte: endDate ? (() => {
          const d = new Date(endDate);
          d.setHours(23, 59, 59, 999);
          return d;
        })() : undefined,
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
          lte: endDate ? (() => {
            const d = new Date(endDate);
            d.setHours(23, 59, 59, 999);
            return d;
          })() : undefined,
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
      if (group.status === 'PENDING') summary.totalPending = Number(group._sum.amount || 0);
      if (group.status === 'PAID') summary.totalPaid = Number(group._sum.amount || 0);
      // 'CANCELLED' ou outros status não foram solicitados explicitamente no summary, 
      // mas o usuário citou totalOverdue. Geralmente PENDING com dueDate < hoje é overdue.
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueAggregation = await prisma.financialRecord.aggregate({
      where: {
        companyId,
        type,
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
    summary.totalOverdue = Number(overdueAggregation._sum.amount || 0);

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
    const end = endDate ? (() => {
      const d = new Date(endDate);
      d.setHours(23, 59, 59, 999);
      return d;
    })() : new Date();

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

    // 1. Receitas: Somar Vendas não canceladas pela data de faturamento (Competência)
    const sales = await prisma.sale.findMany({
      where: { companyId, date: { gte: start, lte: end } },
      include: { status: true }
    });

    let totalRevenues = 0;
    sales.forEach(sale => {
      const sName = sale.status ? sale.status.name.toUpperCase() : '';
      if (!sName.includes('CANCELAD')) {
        totalRevenues += Number(sale.total);
      }
    });

    // 2 e 3. Custos e Despesas: Usar FinancialRecords de PAYABLE pela data de Vencimento
    const payables = await prisma.financialRecord.findMany({
      where: {
        companyId,
        type: 'PAYABLE',
        status: { not: 'CANCELLED' },
        dueDate: { gte: start, lte: end }
      },
      include: { category: true }
    });

    let totalCosts = 0;
    let totalExpenses = 0;

    payables.forEach(record => {
      const amount = Number(record.amount);
      const isCost = record.purchaseId !== null || (record.category && record.category.name.toUpperCase().includes('CUSTO'));
      
      if (isCost) {
        totalCosts += amount;
      } else {
        totalExpenses += amount;
      }
    });

    const tree = [
      {
        id: 'dre-receita',
        cod: '1',
        name: 'Receita Bruta (Faturamento)',
        type: 'REVENUE',
        total: totalRevenues,
        children: []
      },
      {
        id: 'dre-custo',
        cod: '2',
        name: 'Custos Diretos Operacionais',
        type: 'EXPENSE',
        total: totalCosts,
        children: []
      },
      {
        id: 'dre-despesa',
        cod: '3',
        name: 'Despesas Gerais e Administrativas',
        type: 'EXPENSE',
        total: totalExpenses,
        children: []
      }
    ];

    res.json({
      summary: {
        totalRevenues,
        totalExpenses: totalCosts + totalExpenses,
        netProfit: totalRevenues - (totalCosts + totalExpenses)
      },
      tree
    });
  }),

  /**
   * 5. RELATÓRIO DE CHEQUES (GET /api/reports/cheques)
   */
  getProductSalesReport: asyncHandler(async (req, res) => {
    const result = await productSalesReportService.getFullReport(req.companyId, req.query);
    res.json(result);
  }),

  getChequesReport: asyncHandler(async (req, res) => {
    const { startDate, endDate, status, clientName } = req.query;
    const companyId = req.companyId;

    const where = {
      companyId,
      chequeNumber: { not: null },
    };

    if (startDate || endDate) {
      where.chequeDueDate = {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? (() => {
          const d = new Date(endDate);
          d.setHours(23, 59, 59, 999);
          return d;
        })() : undefined,
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
        sale: { 
          select: { 
            cod: true,
            total: true,
            items: {
              include: {
                product: {
                  select: { description: true }
                }
              }
            }
          } 
        },
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
        totalCheques: Number(summary._count.id || 0),
        totalAmount: Number(summary._sum.amount || 0),
      },
    });
  }),
};
