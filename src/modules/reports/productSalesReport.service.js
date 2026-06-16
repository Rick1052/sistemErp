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

function buildProductFilter(companyId, productId, categoryId) {
  const conditions = [Prisma.sql`p."companyId" = ${companyId}`];
  if (productId) conditions.push(Prisma.sql`p.id = ${productId}`);
  if (categoryId) conditions.push(Prisma.sql`p."categoryId" = ${categoryId}`);
  return Prisma.join(conditions, ' AND ');
}

function toNumber(val) {
  return Number(val || 0);
}

function round2(val) {
  return Math.round(toNumber(val) * 100) / 100;
}

export const productSalesReportService = {
  resolveDateRange,

  async getSummary(companyId, filters) {
    const { start, end } = resolveDateRange(filters);
    const productFilter = buildProductFilter(companyId, filters.productId, filters.categoryId);

    const [summaryRow] = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT s.id)::int AS "totalSales",
        COALESCE(SUM(si.quantity), 0)::int AS "totalProductsSold",
        COALESCE(SUM(si.total), 0)::float AS "totalRevenue",
        COALESCE(SUM(si.quantity * COALESCE(NULLIF(p."averageCost", 0), p."costPrice", 0)), 0)::float AS "totalCost"
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId"
      INNER JOIN "Product" p ON p.id = si."productId"
      WHERE s."companyId" = ${companyId}
        AND s.date >= ${start}
        AND s.date <= ${end}
        ${filters.productId ? Prisma.sql`AND p.id = ${filters.productId}` : Prisma.empty}
        ${filters.categoryId ? Prisma.sql`AND p."categoryId" = ${filters.categoryId}` : Prisma.empty}
    `;

    const totalRevenue = round2(summaryRow?.totalRevenue);
    const totalCost = round2(summaryRow?.totalCost);
    const totalSales = toNumber(summaryRow?.totalSales);

    return {
      totalSales,
      totalProductsSold: toNumber(summaryRow?.totalProductsSold),
      totalCost,
      totalRevenue,
      grossProfit: round2(totalRevenue - totalCost),
      averageTicket: totalSales > 0 ? round2(totalRevenue / totalSales) : 0,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
    };
  },

  async getCharts(companyId, filters) {
    const { start, end } = resolveDateRange(filters);

    const revenueByMonth = await prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('month', s.date), 'YYYY-MM') AS period,
        COALESCE(SUM(si.total), 0)::float AS revenue
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId"
      INNER JOIN "Product" p ON p.id = si."productId"
      WHERE s."companyId" = ${companyId}
        AND s.date >= ${start}
        AND s.date <= ${end}
        ${filters.productId ? Prisma.sql`AND p.id = ${filters.productId}` : Prisma.empty}
        ${filters.categoryId ? Prisma.sql`AND p."categoryId" = ${filters.categoryId}` : Prisma.empty}
      GROUP BY DATE_TRUNC('month', s.date)
      ORDER BY period ASC
    `;

    const productFilter = buildProductFilter(companyId, filters.productId, filters.categoryId);

    const quantityByProduct = await prisma.$queryRaw`
      SELECT
        p.id AS "productId",
        p.description AS product,
        COALESCE(SUM(sm.quantity), 0)::int AS quantity
      FROM "StockMovement" sm
      INNER JOIN "Product" p ON p.id = sm."productId"
      WHERE ${productFilter}
        AND sm.type = 'OUT'
        AND sm."createdAt" >= ${start}
        AND sm."createdAt" <= ${end}
      GROUP BY p.id, p.description
      ORDER BY quantity DESC
      LIMIT 10
    `;

    const profitByProduct = await prisma.$queryRaw`
      SELECT
        p.id AS "productId",
        p.description AS product,
        COALESCE(SUM(si.total), 0)::float AS revenue,
        COALESCE(SUM(si.quantity * COALESCE(NULLIF(p."averageCost", 0), p."costPrice", 0)), 0)::float AS cost
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId"
      INNER JOIN "Product" p ON p.id = si."productId"
      WHERE s."companyId" = ${companyId}
        AND s.date >= ${start}
        AND s.date <= ${end}
        ${filters.productId ? Prisma.sql`AND p.id = ${filters.productId}` : Prisma.empty}
        ${filters.categoryId ? Prisma.sql`AND p."categoryId" = ${filters.categoryId}` : Prisma.empty}
      GROUP BY p.id, p.description
      HAVING COALESCE(SUM(si.total), 0) > 0
      ORDER BY (COALESCE(SUM(si.total), 0) - COALESCE(SUM(si.quantity * COALESCE(NULLIF(p."averageCost", 0), p."costPrice", 0)), 0)) DESC
      LIMIT 10
    `;

    return {
      revenueByMonth: revenueByMonth.map((r) => ({
        period: r.period,
        revenue: round2(r.revenue),
      })),
      quantityByProduct: quantityByProduct.map((r) => ({
        productId: r.productId,
        product: r.product,
        quantity: toNumber(r.quantity),
      })),
      profitByProduct: profitByProduct.map((r) => ({
        productId: r.productId,
        product: r.product,
        profit: round2(toNumber(r.revenue) - toNumber(r.cost)),
      })),
    };
  },

  async getSalesByProduct(companyId, filters, { page = 1, limit = 20 }) {
    const { start, end } = resolveDateRange(filters);
    const offset = (page - 1) * limit;
    const productFilter = buildProductFilter(companyId, filters.productId, filters.categoryId);

    const [countRow] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total FROM (
        SELECT p.id
        FROM "Product" p
        LEFT JOIN "StockMovement" sm ON sm."productId" = p.id AND sm."companyId" = p."companyId"
          AND sm.type = 'OUT' AND sm."createdAt" >= ${start} AND sm."createdAt" <= ${end}
        LEFT JOIN "SaleItem" si ON si."productId" = p.id
        LEFT JOIN "Sale" s ON s.id = si."saleId" AND s."companyId" = ${companyId}
          AND s.date >= ${start} AND s.date <= ${end}
        WHERE ${productFilter}
        GROUP BY p.id
        HAVING COALESCE(SUM(sm.quantity), 0) > 0 OR COALESCE(SUM(si.total), 0) > 0
      ) sub
    `;

    const rows = await prisma.$queryRaw`
      SELECT
        p.id AS "productId",
        p.description AS product,
        COALESCE(out_data.quantity, 0)::int AS "quantitySold",
        COALESCE(NULLIF(p."averageCost", 0), p."costPrice", 0)::float AS "averageUnitCost",
        COALESCE(sale_data."avgSalePrice", 0)::float AS "averageSalePrice",
        COALESCE(sale_data.revenue, 0)::float AS "totalRevenue"
      FROM "Product" p
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sm.quantity), 0) AS quantity
        FROM "StockMovement" sm
        WHERE sm."productId" = p.id AND sm."companyId" = p."companyId"
          AND sm.type = 'OUT' AND sm."createdAt" >= ${start} AND sm."createdAt" <= ${end}
      ) out_data ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(AVG(si."unitPrice"), 0) AS "avgSalePrice",
          COALESCE(SUM(si.total), 0) AS revenue
        FROM "SaleItem" si
        INNER JOIN "Sale" s ON s.id = si."saleId"
        WHERE si."productId" = p.id AND s."companyId" = ${companyId}
          AND s.date >= ${start} AND s.date <= ${end}
      ) sale_data ON true
      WHERE ${productFilter}
        AND (COALESCE(out_data.quantity, 0) > 0 OR COALESCE(sale_data.revenue, 0) > 0)
      ORDER BY COALESCE(out_data.quantity, 0) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = rows.map((row) => {
      const quantitySold = toNumber(row.quantitySold);
      const averageUnitCost = round2(row.averageUnitCost);
      const totalCost = round2(quantitySold * averageUnitCost);
      const totalRevenue = round2(row.totalRevenue);
      return {
        productId: row.productId,
        product: row.product,
        quantitySold,
        averageUnitCost,
        averageSalePrice: round2(row.averageSalePrice),
        totalCost,
        totalRevenue,
        grossProfit: round2(totalRevenue - totalCost),
      };
    });

    const [grandTotalsRow] = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(out_data.quantity), 0)::int AS "quantitySold",
        COALESCE(SUM(out_data.quantity * COALESCE(NULLIF(p."averageCost", 0), p."costPrice", 0)), 0)::float AS "totalCost",
        COALESCE(SUM(sale_data.revenue), 0)::float AS "totalRevenue"
      FROM "Product" p
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sm.quantity), 0) AS quantity
        FROM "StockMovement" sm
        WHERE sm."productId" = p.id AND sm."companyId" = p."companyId"
          AND sm.type = 'OUT' AND sm."createdAt" >= ${start} AND sm."createdAt" <= ${end}
      ) out_data ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(si.total), 0) AS revenue
        FROM "SaleItem" si
        INNER JOIN "Sale" s ON s.id = si."saleId"
        WHERE si."productId" = p.id AND s."companyId" = ${companyId}
          AND s.date >= ${start} AND s.date <= ${end}
      ) sale_data ON true
      WHERE ${productFilter}
        AND (COALESCE(out_data.quantity, 0) > 0 OR COALESCE(sale_data.revenue, 0) > 0)
    `;

    const grandTotals = {
      quantitySold: toNumber(grandTotalsRow?.quantitySold),
      totalCost: round2(grandTotalsRow?.totalCost),
      totalRevenue: round2(grandTotalsRow?.totalRevenue),
      grossProfit: round2(toNumber(grandTotalsRow?.totalRevenue) - toNumber(grandTotalsRow?.totalCost)),
    };

    return {
      data,
      totals: grandTotals,
      pagination: {
        page,
        limit,
        total: toNumber(countRow?.total),
        totalPages: Math.ceil(toNumber(countRow?.total) / limit) || 1,
      },
    };
  },

  async getStockMovement(companyId, filters, { page = 1, limit = 20 }) {
    const { start, end } = resolveDateRange(filters);
    const offset = (page - 1) * limit;
    const productFilter = buildProductFilter(companyId, filters.productId, filters.categoryId);

    const [countRow] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total
      FROM "Product" p
      WHERE ${productFilter}
        AND EXISTS (
          SELECT 1 FROM "StockMovement" sm
          WHERE sm."productId" = p.id AND sm."companyId" = p."companyId"
        )
    `;

    const rows = await prisma.$queryRaw`
      SELECT
        p.id AS "productId",
        p.description AS product,
        COALESCE(SUM(CASE WHEN sm."createdAt" < ${start} AND sm.type = 'IN' THEN sm.quantity
                          WHEN sm."createdAt" < ${start} AND sm.type = 'OUT' THEN -sm.quantity
                          ELSE 0 END), 0)::int AS "initialStock",
        COALESCE(SUM(CASE WHEN sm."createdAt" >= ${start} AND sm."createdAt" <= ${end} AND sm.type = 'IN' THEN sm.quantity ELSE 0 END), 0)::int AS entries,
        COALESCE(SUM(CASE WHEN sm."createdAt" >= ${start} AND sm."createdAt" <= ${end} AND sm.type = 'OUT' THEN sm.quantity ELSE 0 END), 0)::int AS exits
      FROM "Product" p
      LEFT JOIN "StockMovement" sm ON sm."productId" = p.id AND sm."companyId" = p."companyId"
      WHERE ${productFilter}
        AND EXISTS (
          SELECT 1 FROM "StockMovement" sm2
          WHERE sm2."productId" = p.id AND sm2."companyId" = p."companyId"
        )
      GROUP BY p.id, p.description
      ORDER BY p.description ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = rows.map((row) => {
      const initialStock = toNumber(row.initialStock);
      const entries = toNumber(row.entries);
      const exits = toNumber(row.exits);
      return {
        productId: row.productId,
        product: row.product,
        initialStock,
        entries,
        exits,
        currentStock: initialStock + entries - exits,
      };
    });

    const [grandTotalsRow] = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(CASE WHEN sm."createdAt" < ${start} AND sm.type = 'IN' THEN sm.quantity
                          WHEN sm."createdAt" < ${start} AND sm.type = 'OUT' THEN -sm.quantity
                          ELSE 0 END), 0)::int AS "initialStock",
        COALESCE(SUM(CASE WHEN sm."createdAt" >= ${start} AND sm."createdAt" <= ${end} AND sm.type = 'IN' THEN sm.quantity ELSE 0 END), 0)::int AS entries,
        COALESCE(SUM(CASE WHEN sm."createdAt" >= ${start} AND sm."createdAt" <= ${end} AND sm.type = 'OUT' THEN sm.quantity ELSE 0 END), 0)::int AS exits
      FROM "Product" p
      LEFT JOIN "StockMovement" sm ON sm."productId" = p.id AND sm."companyId" = p."companyId"
      WHERE ${productFilter}
        AND EXISTS (
          SELECT 1 FROM "StockMovement" sm2
          WHERE sm2."productId" = p.id AND sm2."companyId" = p."companyId"
        )
    `;

    const initialStock = toNumber(grandTotalsRow?.initialStock);
    const entries = toNumber(grandTotalsRow?.entries);
    const exits = toNumber(grandTotalsRow?.exits);

    return {
      data,
      totals: {
        initialStock,
        entries,
        exits,
        currentStock: initialStock + entries - exits,
      },
      pagination: {
        page,
        limit,
        total: toNumber(countRow?.total),
        totalPages: Math.ceil(toNumber(countRow?.total) / limit) || 1,
      },
    };
  },

  async getSalesByPeriod(companyId, filters, periodView = 'monthly') {
    const { start, end } = resolveDateRange(filters);

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
        COALESCE(SUM(si.quantity), 0)::int AS "quantitySold",
        COALESCE(SUM(si.total), 0)::float AS revenue,
        COALESCE(SUM(si.quantity * COALESCE(NULLIF(p."averageCost", 0), p."costPrice", 0)), 0)::float AS cost
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId"
      INNER JOIN "Product" p ON p.id = si."productId"
      WHERE s."companyId" = ${companyId}
        AND s.date >= ${start}
        AND s.date <= ${end}
        ${filters.productId ? Prisma.sql`AND p.id = ${filters.productId}` : Prisma.empty}
        ${filters.categoryId ? Prisma.sql`AND p."categoryId" = ${filters.categoryId}` : Prisma.empty}
      GROUP BY DATE_TRUNC(${Prisma.raw(`'${unit}'`)}, s.date)
      ORDER BY "sortDate" ASC
    `;

    const data = rows.map((row) => {
      const revenue = round2(row.revenue);
      const cost = round2(row.cost);
      return {
        period: row.period,
        quantitySold: toNumber(row.quantitySold),
        revenue,
        cost,
        profit: round2(revenue - cost),
      };
    });

    const totals = data.reduce(
      (acc, row) => ({
        quantitySold: acc.quantitySold + row.quantitySold,
        revenue: acc.revenue + row.revenue,
        cost: acc.cost + row.cost,
        profit: acc.profit + row.profit,
      }),
      { quantitySold: 0, revenue: 0, cost: 0, profit: 0 }
    );

    return { data, totals, periodView };
  },

  async getFullReport(companyId, query) {
    const filters = {
      startDate: query.startDate,
      endDate: query.endDate,
      month: query.month,
      year: query.year,
      productId: query.productId || undefined,
      categoryId: query.categoryId || undefined,
    };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const periodView = query.periodView || 'monthly';
    const section = query.section || 'all';

    const result = { filters: resolveDateRange(filters) };

    if (section === 'all' || section === 'summary') {
      const [summary, charts] = await Promise.all([
        this.getSummary(companyId, filters),
        this.getCharts(companyId, filters),
      ]);
      result.summary = summary;
      result.charts = charts;
    }

    if (section === 'all' || section === 'sales-by-product') {
      result.salesByProduct = await this.getSalesByProduct(companyId, filters, { page, limit });
    }

    if (section === 'all' || section === 'stock-movement') {
      result.stockMovement = await this.getStockMovement(companyId, filters, { page, limit });
    }

    if (section === 'all' || section === 'by-period') {
      result.salesByPeriod = await this.getSalesByPeriod(companyId, filters, periodView);
    }

    result.period = {
      startDate: result.filters.start.toISOString(),
      endDate: result.filters.end.toISOString(),
    };
    delete result.filters;

    return result;
  },
};
