import prisma from '../../database/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { productSalesReportService } from './productSalesReport.service.js';
import { salesReportService } from './salesReport.service.js';
import { commercialSalesReportService } from './commercialSalesReport.service.js';
import { resolveCostCenterScope } from '../costCenters/costCenter.service.js';

function bankTransactionCostCenterWhere(costCenterScope) {
  if (!Object.hasOwn(costCenterScope, 'costCenterId')) return {};
  if (costCenterScope.costCenterId === null) {
    return {
      OR: [
        { financialRecordId: null },
        { financialRecord: { is: { costCenterId: null } } },
      ],
    };
  }
  return { financialRecord: { is: { costCenterId: costCenterScope.costCenterId } } };
}

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
    const { startDate, endDate, type, status, costCenterScope } = req.query;
    const companyId = req.companyId;

    if (!type || !['PAYABLE', 'RECEIVABLE'].includes(type)) {
      throw new AppError('O parâmetro "type" (PAYABLE ou RECEIVABLE) é obrigatório.', 400);
    }

    const resolvedCostCenterScope = await resolveCostCenterScope(
      prisma,
      companyId,
      costCenterScope,
    );
    const baseWhere = {
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
      ...resolvedCostCenterScope,
    };
    const where = { ...baseWhere, status: status || undefined };

    const records = await prisma.financialRecord.findMany({
      where,
      include: {
        client: true,
        supplier: true,
        category: true,
        bankAccount: true,
        costCenter: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Agrupamento por status usando groupBy para performance
    const groups = await prisma.financialRecord.groupBy({
      by: ['status'],
      where: baseWhere,
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
        ...resolvedCostCenterScope,
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
    const { startDate, endDate, bankAccountId, costCenterScope } = req.query;
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

    const resolvedCostCenterScope = await resolveCostCenterScope(
      prisma,
      companyId,
      costCenterScope,
    );
    const scopedTransactionWhere = bankTransactionCostCenterWhere(resolvedCostCenterScope);

    // 2. Calcular o saldo inicial na startDate
    // Saldo Inicial = Saldo de abertura da conta + (Créditos - Débitos antes da startDate)
    // Note: No sistema, assumimos que TransactionType define se é positivo ou negativo? 
    // Olhando o schema: TransactionType { CREDIT, DEBIT }.
    // Precisamos somar créditos e subtrair débitos.
    
    const creditsBefore = await prisma.bankTransaction.aggregate({
      where: { companyId, bankAccountId, type: 'CREDIT', date: { lt: start }, ...scopedTransactionWhere },
      _sum: { amount: true }
    });
    const debitsBefore = await prisma.bankTransaction.aggregate({
      where: { companyId, bankAccountId, type: 'DEBIT', date: { lt: start }, ...scopedTransactionWhere },
      _sum: { amount: true }
    });

    const includeAccountOpeningBalance =
      !Object.hasOwn(resolvedCostCenterScope, 'costCenterId') ||
      resolvedCostCenterScope.costCenterId === null;
    const initialBalanceOnDate = (includeAccountOpeningBalance ? Number(bankAccount.initialBalance) : 0) +
      (Number(creditsBefore._sum.amount || 0) - Number(debitsBefore._sum.amount || 0));

    // 3. Buscar transações no período
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        companyId,
        date: {
          gte: start,
          lte: end,
        },
        ...scopedTransactionWhere,
      },
      include: { financialRecord: { include: { costCenter: true } } },
      orderBy: { date: 'asc' },
    });

    // 4. Totais do período
    const periodCredits = await prisma.bankTransaction.aggregate({
      where: { companyId, bankAccountId, type: 'CREDIT', date: { gte: start, lte: end }, ...scopedTransactionWhere },
      _sum: { amount: true }
    });
    const periodDebits = await prisma.bankTransaction.aggregate({
      where: { companyId, bankAccountId, type: 'DEBIT', date: { gte: start, lte: end }, ...scopedTransactionWhere },
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
    const { startDate, endDate, costCenterScope } = req.query;
    const companyId = req.companyId;

    if (!startDate || !endDate) {
      throw new AppError('As datas startDate e endDate são obrigatórias.', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const resolvedCostCenterScope = await resolveCostCenterScope(
      prisma,
      companyId,
      costCenterScope,
    );

    // 1. Receitas: Somar Vendas não canceladas pela data de faturamento (Competência)
    const sales = await prisma.sale.findMany({
      where: { companyId, date: { gte: start, lte: end }, ...resolvedCostCenterScope },
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
        dueDate: { gte: start, lte: end },
        ...resolvedCostCenterScope,
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
    const { startDate, endDate, status, clientName, search, costCenterScope } = req.query;
    const companyId = req.companyId;

    const resolvedCostCenterScope = await resolveCostCenterScope(
      prisma,
      companyId,
      costCenterScope,
    );

    const where = {
      companyId,
      chequeNumber: { not: null },
      AND: [],
      ...resolvedCostCenterScope,
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
      where.AND.push({
        OR: [
          { chequeCustomer: { name: { contains: clientName, mode: 'insensitive' } } },
          { client: { name: { contains: clientName, mode: 'insensitive' } } },
        ],
      });
    }

    // Busca por número do cheque ou titular.
    if (search) {
      const term = String(search).trim();
      const or = [
        { chequeOwner: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];

      if (/^\d+$/.test(term)) {
        // Número puro: os cheques são gravados com zeros à esquerda de forma
        // inconsistente ("000726" e "3100" convivem). Casamos o valor exato em
        // todas as larguras de zero, para "726" achar "000726" sem arrastar
        // "001413" junto — o que um `contains` faria.
        const base = term.replace(/^0+/, '') || '0';
        const variantes = new Set([term, base]);
        for (let len = base.length + 1; len <= 8; len++) variantes.add(base.padStart(len, '0'));
        for (const v of variantes) or.push({ chequeNumber: v });
      } else {
        or.push({ chequeNumber: { contains: term, mode: 'insensitive' } });
      }

      where.AND.push({ OR: or });
    }

    if (where.AND.length === 0) delete where.AND;

    const cheques = await prisma.financialRecord.findMany({
      where,
      include: {
        chequeCustomer: true,
        client: true,
        costCenter: true,
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
      // Controle de cheque se organiza pelo "bom para", não pela data da venda.
      // Ordenar por `date` jogava um cheque recém-lançado numa venda antiga para
      // o meio da lista, dando a impressão de que não tinha entrado.
      orderBy: [
        { chequeDueDate: { sort: 'desc', nulls: 'last' } },
        { cod: 'desc' },
      ],
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
