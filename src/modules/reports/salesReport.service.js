import prisma from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

function parseEndDate(endDate) {
  const d = new Date(endDate);
  d.setHours(23, 59, 59, 999);
  return d;
}

function resolveDateRange({ startDate, endDate, month, year }) {
  const now = new Date();
  const y = year ? Number(year) : now.getFullYear();

  if (month && year) {
    const m = Number(month) - 1;
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (year && !month) {
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? parseEndDate(endDate) : parseEndDate(now.toISOString().split('T')[0]);
  return { start, end };
}

function toNumber(val) {
  return Number(val || 0);
}

function round2(val) {
  return Math.round(toNumber(val) * 100) / 100;
}

function buildSaleFilters(companyId, { start, end, statusId, clientId }) {
  const parts = [
    Prisma.sql`s."companyId" = ${companyId}`,
    Prisma.sql`s.date >= ${start}`,
    Prisma.sql`s.date <= ${end}`,
    Prisma.sql`UPPER(ss.name) NOT LIKE '%CANCELAD%'`,
  ];

  if (statusId) parts.push(Prisma.sql`s."statusId" = ${statusId}`);
  if (clientId) parts.push(Prisma.sql`s."clientId" = ${clientId}`);

  return Prisma.join(parts, ' AND ');
}

export const salesReportService = {
  resolveDateRange,

  async getSummary(companyId, filters) {
    const { start, end } = resolveDateRange(filters);
    const whereSql = buildSaleFilters(companyId, { start, end, statusId: filters.statusId, clientId: filters.clientId });

    const [row] = await prisma.$queryRaw`
      SELECT
        COUNT(s.id)::int AS "totalSales",
        COALESCE(SUM(s.total), 0)::float AS "totalAmount",
        COALESCE(SUM(s.discount), 0)::float AS "totalDiscount",
        COALESCE(SUM(s.freight), 0)::float AS "totalFreight",
        COALESCE(SUM(s.subtotal), 0)::float AS "totalSubtotal"
      FROM "Sale" s
      INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
      WHERE ${whereSql}
    `;

    const totalSales = toNumber(row?.totalSales);
    const totalAmount = round2(row?.totalAmount);

    return {
      totalSales,
      totalAmount,
      totalSubtotal: round2(row?.totalSubtotal),
      totalDiscount: round2(row?.totalDiscount),
      totalFreight: round2(row?.totalFreight),
      averageTicket: totalSales > 0 ? round2(totalAmount / totalSales) : 0,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
    };
  },

  async getCharts(companyId, filters) {
    const { start, end } = resolveDateRange(filters);
    const whereSql = buildSaleFilters(companyId, { start, end, statusId: filters.statusId, clientId: filters.clientId });

    const [revenueByMonth, salesByStatus, topClients] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('month', s.date), 'MM/YYYY') AS period,
          DATE_TRUNC('month', s.date) AS "sortDate",
          COUNT(s.id)::int AS "salesCount",
          COALESCE(SUM(s.total), 0)::float AS revenue
        FROM "Sale" s
        INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
        WHERE ${whereSql}
        GROUP BY DATE_TRUNC('month', s.date)
        ORDER BY "sortDate" ASC
      `,
      prisma.$queryRaw`
        SELECT
          ss.name AS status,
          ss.color AS color,
          COUNT(s.id)::int AS count,
          COALESCE(SUM(s.total), 0)::float AS revenue
        FROM "Sale" s
        INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
        WHERE ${whereSql}
        GROUP BY ss.id, ss.name, ss.color
        ORDER BY revenue DESC
      `,
      prisma.$queryRaw`
        SELECT
          c.name AS client,
          COUNT(s.id)::int AS "salesCount",
          COALESCE(SUM(s.total), 0)::float AS revenue
        FROM "Sale" s
        INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
        INNER JOIN "Client" c ON c.id = s."clientId"
        WHERE ${whereSql}
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
        LIMIT 10
      `,
    ]);

    return {
      revenueByMonth: revenueByMonth.map((r) => ({
        period: r.period,
        salesCount: toNumber(r.salesCount),
        revenue: round2(r.revenue),
      })),
      salesByStatus: salesByStatus.map((r) => ({
        status: r.status,
        color: r.color,
        count: toNumber(r.count),
        revenue: round2(r.revenue),
      })),
      topClients: topClients.map((r) => ({
        client: r.client,
        salesCount: toNumber(r.salesCount),
        revenue: round2(r.revenue),
      })),
    };
  },

  async getSalesList(companyId, filters, page = 1, limit = 20) {
    const { start, end } = resolveDateRange(filters);
    const whereSql = buildSaleFilters(companyId, { start, end, statusId: filters.statusId, clientId: filters.clientId });
    const offset = (page - 1) * limit;

    const [countRow] = await prisma.$queryRaw`
      SELECT COUNT(s.id)::int AS total
      FROM "Sale" s
      INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
      WHERE ${whereSql}
    `;

    const rows = await prisma.$queryRaw`
      SELECT
        s.id,
        s.cod,
        s.date,
        s.subtotal::float AS subtotal,
        s.discount::float AS discount,
        s.freight::float AS freight,
        s.total::float AS total,
        c.name AS "clientName",
        ss.name AS "statusName",
        ss.color AS "statusColor",
        pm.name AS "paymentMethodName",
        COUNT(si.id)::int AS "itemsCount"
      FROM "Sale" s
      INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
      INNER JOIN "Client" c ON c.id = s."clientId"
      LEFT JOIN "PaymentMethod" pm ON pm.id = s."paymentMethodId"
      LEFT JOIN "SaleItem" si ON si."saleId" = s.id
      WHERE ${whereSql}
      GROUP BY s.id, s.cod, s.date, s.subtotal, s.discount, s.freight, s.total, c.name, ss.name, ss.color, pm.name
      ORDER BY s.date DESC, s.cod DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [totalsRow] = await prisma.$queryRaw`
      SELECT
        COUNT(s.id)::int AS "salesCount",
        COALESCE(SUM(s.subtotal), 0)::float AS subtotal,
        COALESCE(SUM(s.discount), 0)::float AS discount,
        COALESCE(SUM(s.freight), 0)::float AS freight,
        COALESCE(SUM(s.total), 0)::float AS total
      FROM "Sale" s
      INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
      WHERE ${whereSql}
    `;

    const total = toNumber(countRow?.total);

    return {
      data: rows.map((r) => ({
        id: r.id,
        cod: toNumber(r.cod),
        date: r.date,
        client: r.clientName,
        status: { name: r.statusName, color: r.statusColor },
        subtotal: round2(r.subtotal),
        discount: round2(r.discount),
        freight: round2(r.freight),
        total: round2(r.total),
        itemsCount: toNumber(r.itemsCount),
        paymentMethod: r.paymentMethodName,
      })),
      totals: {
        salesCount: toNumber(totalsRow?.salesCount),
        subtotal: round2(totalsRow?.subtotal),
        discount: round2(totalsRow?.discount),
        freight: round2(totalsRow?.freight),
        total: round2(totalsRow?.total),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async getSalesByPeriod(companyId, filters, periodView = 'monthly') {
    const { start, end } = resolveDateRange(filters);
    const whereSql = buildSaleFilters(companyId, { start, end, statusId: filters.statusId, clientId: filters.clientId });

    const truncConfig = {
      daily: { unit: 'day', format: 'DD/MM/YYYY' },
      monthly: { unit: 'month', format: 'MM/YYYY' },
      yearly: { unit: 'year', format: 'YYYY' },
    };
    const { unit, format: dateFormat } = truncConfig[periodView] || truncConfig.monthly;

    const rows = await prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC(${Prisma.raw(`'${unit}'`)}, s.date), ${Prisma.raw(`'${dateFormat}'`)}) AS period,
        DATE_TRUNC(${Prisma.raw(`'${unit}'`)}, s.date) AS "sortDate",
        COUNT(s.id)::int AS "salesCount",
        COALESCE(SUM(s.total), 0)::float AS revenue
      FROM "Sale" s
      INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
      WHERE ${whereSql}
      GROUP BY DATE_TRUNC(${Prisma.raw(`'${unit}'`)}, s.date)
      ORDER BY "sortDate" ASC
    `;

    const data = rows.map((row) => {
      const salesCount = toNumber(row.salesCount);
      const revenue = round2(row.revenue);
      return {
        period: row.period,
        salesCount,
        revenue,
        averageTicket: salesCount > 0 ? round2(revenue / salesCount) : 0,
      };
    });

    const totals = data.reduce(
      (acc, row) => ({
        salesCount: acc.salesCount + row.salesCount,
        revenue: round2(acc.revenue + row.revenue),
      }),
      { salesCount: 0, revenue: 0 }
    );

    return { data, totals, periodView };
  },

  async getFullReport(companyId, query = {}) {
    const section = query.section || 'all';
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 10000);
    const periodView = query.periodView || 'monthly';

    const filters = {
      startDate: query.startDate,
      endDate: query.endDate,
      month: query.month,
      year: query.year,
      statusId: query.statusId || undefined,
      clientId: query.clientId || undefined,
    };

    const { start, end } = resolveDateRange(filters);
    const period = { startDate: start.toISOString(), endDate: end.toISOString() };

    const result = { period };

    if (section === 'all' || section === 'summary') {
      result.summary = await this.getSummary(companyId, filters);
      result.charts = await this.getCharts(companyId, filters);
    }

    if (section === 'all' || section === 'sales-list') {
      result.sales = await this.getSalesList(companyId, filters, page, limit);
    }

    if (section === 'all' || section === 'by-period') {
      result.salesByPeriod = await this.getSalesByPeriod(companyId, filters, periodView);
    }

    return result;
  },
};
