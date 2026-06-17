import prisma from '../../database/prisma.js';

function startOfDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function openAmount(record) {
  return Math.max(0, Number(record.amount) - Number(record.paidAmount || 0));
}

function sumOpenAmount(records) {
  return records.reduce((sum, r) => sum + openAmount(r), 0);
}

export const dashboardService = {
  async getSummary(companyId) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const financialInclude = {
      client: { select: { id: true, name: true, document: true } },
      supplier: { select: { id: true, name: true, document: true } },
    };

    const [
      clientCount,
      recentClients,
      productCount,
      bankAccounts,
      salesTodayAgg,
      salesMonthAgg,
      pendingReceivableRecords,
      pendingPayableRecords,
      receivablesToday,
      payablesToday,
    ] = await Promise.all([
      prisma.client.count({ where: { companyId } }),
      prisma.client.findMany({
        where: { companyId },
        select: { id: true, name: true, document: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.product.count({ where: { companyId } }),
      prisma.bankAccount.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { currentBalance: true },
      }),
      prisma.sale.aggregate({
        where: { companyId, date: { gte: todayStart, lte: todayEnd } },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: { companyId, date: { gte: monthStart, lte: monthEnd } },
        _sum: { total: true },
      }),
      prisma.financialRecord.findMany({
        where: {
          companyId,
          type: 'RECEIVABLE',
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        select: { amount: true, paidAmount: true },
      }),
      prisma.financialRecord.findMany({
        where: {
          companyId,
          type: 'PAYABLE',
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        select: { amount: true, paidAmount: true },
      }),
      prisma.financialRecord.findMany({
        where: {
          companyId,
          type: 'RECEIVABLE',
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          dueDate: { gte: todayStart, lte: todayEnd },
        },
        include: financialInclude,
        orderBy: { dueDate: 'asc' },
        take: 50,
      }),
      prisma.financialRecord.findMany({
        where: {
          companyId,
          type: 'PAYABLE',
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          dueDate: { gte: todayStart, lte: todayEnd },
        },
        include: financialInclude,
        orderBy: { dueDate: 'asc' },
        take: 50,
      }),
    ]);

    const cashBalance = bankAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);

    return {
      clients: { total: clientCount, recent: recentClients },
      products: { total: productCount },
      salesToday: Number(salesTodayAgg._sum.total || 0),
      salesMonth: Number(salesMonthAgg._sum.total || 0),
      receivablesToday,
      payablesToday,
      pendingReceivables: sumOpenAmount(pendingReceivableRecords),
      pendingPayables: sumOpenAmount(pendingPayableRecords),
      cashBalance,
    };
  },
};
