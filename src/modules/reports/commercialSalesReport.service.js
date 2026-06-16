import prisma from '../../database/prisma.js';
import { Prisma } from '@prisma/client';
import { salesReportService } from './salesReport.service.js';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function toNumber(val) {
  return Number(val || 0);
}

function round2(val) {
  return Math.round(toNumber(val) * 100) / 100;
}

function pct(part, total) {
  if (!total) return 0;
  return round2((part / total) * 100);
}

function listMonthsInRange(start, end) {
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: `${MONTH_LABELS[cursor.getMonth()]}/${cursor.getFullYear()}`,
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function classifyFrequency({ isNewClient, ordersInPeriod, amountInPeriod, vipThreshold }) {
  if (isNewClient) return 'Cliente Novo';
  if (ordersInPeriod >= 10 || amountInPeriod >= vipThreshold) return 'Cliente VIP';
  if (ordersInPeriod >= 3) return 'Cliente Recorrente';
  return 'Cliente Ocasional';
}

function buildSaleWhereParts(companyId, { start, end, filters }) {
  const parts = [
    Prisma.sql`s."companyId" = ${companyId}`,
    Prisma.sql`s.date >= ${start}`,
    Prisma.sql`s.date <= ${end}`,
    Prisma.sql`UPPER(ss.name) NOT LIKE '%CANCELAD%'`,
  ];

  if (filters.clientId) parts.push(Prisma.sql`s."clientId" = ${filters.clientId}`);
  if (filters.city) parts.push(Prisma.sql`c.city = ${filters.city}`);
  if (filters.state) parts.push(Prisma.sql`c.state = ${filters.state}`);

  if (filters.productId || filters.categoryId) {
    const itemParts = [Prisma.sql`si."saleId" = s.id`];
    if (filters.productId) itemParts.push(Prisma.sql`p.id = ${filters.productId}`);
    if (filters.categoryId) itemParts.push(Prisma.sql`p."categoryId" = ${filters.categoryId}`);
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "SaleItem" si
      INNER JOIN "Product" p ON p.id = si."productId"
      WHERE ${Prisma.join(itemParts, ' AND ')}
    )`);
  }

  if (filters.sellerId) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "StockMovement" sm
      WHERE sm."companyId" = s."companyId"
        AND sm."documentRef" = s.cod::text
        AND sm."userId" = ${filters.sellerId}
    )`);
  }

  return Prisma.join(parts, ' AND ');
}

function itemFilterSql(filters) {
  const parts = [];
  if (filters.productId) parts.push(Prisma.sql`p.id = ${filters.productId}`);
  if (filters.categoryId) parts.push(Prisma.sql`p."categoryId" = ${filters.categoryId}`);
  return parts.length ? Prisma.join(parts, ' AND ') : null;
}

export const commercialSalesReportService = {
  async getFullReport(companyId, query = {}) {
    const filters = {
      startDate: query.startDate,
      endDate: query.endDate,
      month: query.month,
      year: query.year,
      clientId: query.clientId || undefined,
      productId: query.productId || undefined,
      categoryId: query.categoryId || undefined,
      sellerId: query.sellerId || undefined,
      city: query.city || undefined,
      state: query.state || undefined,
    };

    const { start, end } = salesReportService.resolveDateRange(filters);
    const period = { startDate: start.toISOString(), endDate: end.toISOString() };
    const whereSql = buildSaleWhereParts(companyId, { start, end, filters });
    const itemFilter = itemFilterSql(filters);
    const hasItemFilter = Boolean(itemFilter);

    const revenueExpr = hasItemFilter
      ? Prisma.sql`COALESCE((
          SELECT SUM(si.total) FROM "SaleItem" si
          INNER JOIN "Product" p ON p.id = si."productId"
          WHERE si."saleId" = s.id AND ${itemFilter}
        ), 0)`
      : Prisma.sql`s.total`;

    const qtyExpr = hasItemFilter
      ? Prisma.sql`COALESCE((
          SELECT SUM(si.quantity) FROM "SaleItem" si
          INNER JOIN "Product" p ON p.id = si."productId"
          WHERE si."saleId" = s.id AND ${itemFilter}
        ), 0)::int`
      : Prisma.sql`COALESCE((
          SELECT SUM(si.quantity) FROM "SaleItem" si WHERE si."saleId" = s.id
        ), 0)::int`;

    const [lifetimeRows, periodSalesRows, productRows, filterOptions] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          s."clientId",
          MIN(s.date) AS "firstPurchase",
          MAX(s.date) AS "lastPurchase",
          COUNT(s.id)::int AS "totalOrders",
          COALESCE(SUM(s.total), 0)::float AS "totalSpent"
        FROM "Sale" s
        INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
        WHERE s."companyId" = ${companyId}
          AND UPPER(ss.name) NOT LIKE '%CANCELAD%'
        GROUP BY s."clientId"
      `,
      prisma.$queryRaw`
        SELECT
          s.id AS "saleId",
          s.cod,
          s.date,
          s."clientId",
          c.name AS "clientName",
          c.city,
          c.state,
          (${revenueExpr})::float AS revenue,
          (${qtyExpr}) AS "itemsQty",
          seller."sellerId",
          seller."sellerName"
        FROM "Sale" s
        INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
        INNER JOIN "Client" c ON c.id = s."clientId"
        LEFT JOIN LATERAL (
          SELECT sm."userId" AS "sellerId", u.name AS "sellerName"
          FROM "StockMovement" sm
          LEFT JOIN "User" u ON u.id = sm."userId"
          WHERE sm."companyId" = s."companyId" AND sm."documentRef" = s.cod::text
          ORDER BY sm."createdAt" ASC
          LIMIT 1
        ) seller ON TRUE
        WHERE ${whereSql}
        ORDER BY s.date DESC
      `,
      prisma.$queryRaw`
        SELECT
          p.id AS "productId",
          p.description AS product,
          COALESCE(SUM(si.quantity), 0)::int AS "quantitySold",
          COALESCE(SUM(si.total), 0)::float AS "revenue",
          COUNT(DISTINCT s."clientId")::int AS "clientsServed"
        FROM "SaleItem" si
        INNER JOIN "Sale" s ON s.id = si."saleId"
        INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
        INNER JOIN "Product" p ON p.id = si."productId"
        INNER JOIN "Client" c ON c.id = s."clientId"
        WHERE ${whereSql}
        ${itemFilter ? Prisma.sql`AND ${itemFilter}` : Prisma.empty}
        GROUP BY p.id, p.description
        ORDER BY SUM(si.quantity) DESC
      `,
      this.getFilterOptions(companyId),
    ]);

    const lifetimeMap = new Map();
    lifetimeRows.forEach((row) => {
      lifetimeMap.set(row.clientId, {
        firstPurchase: new Date(row.firstPurchase),
        lastPurchase: new Date(row.lastPurchase),
        totalOrders: toNumber(row.totalOrders),
        totalSpent: round2(row.totalSpent),
      });
    });

    const sales = periodSalesRows.map((row) => ({
      saleId: row.saleId,
      cod: toNumber(row.cod),
      date: new Date(row.date),
      clientId: row.clientId,
      clientName: row.clientName,
      city: row.city,
      state: row.state,
      revenue: round2(row.revenue),
      itemsQty: toNumber(row.itemsQty),
      sellerId: row.sellerId || null,
      sellerName: row.sellerName || 'Sem vendedor',
    }));

    const totalRevenue = round2(sales.reduce((acc, s) => acc + s.revenue, 0));
    const totalOrders = sales.length;
    const totalItems = sales.reduce((acc, s) => acc + s.itemsQty, 0);
    const clientsServed = new Set(sales.map((s) => s.clientId)).size;

    const clientAgg = new Map();
    sales.forEach((sale) => {
      if (!clientAgg.has(sale.clientId)) {
        const life = lifetimeMap.get(sale.clientId);
        const firstPurchase = life?.firstPurchase || sale.date;
        const isNewClient = firstPurchase >= start && firstPurchase <= end;
        clientAgg.set(sale.clientId, {
          clientId: sale.clientId,
          clientName: sale.clientName,
          firstPurchase,
          lastPurchase: sale.date,
          ordersInPeriod: 0,
          amountInPeriod: 0,
          quantityInPeriod: 0,
          isNewClient,
        });
      }
      const agg = clientAgg.get(sale.clientId);
      agg.ordersInPeriod += 1;
      agg.amountInPeriod = round2(agg.amountInPeriod + sale.revenue);
      agg.quantityInPeriod += sale.itemsQty;
      if (sale.date > agg.lastPurchase) agg.lastPurchase = sale.date;
    });

    const clientValues = [...clientAgg.values()];
    const amounts = clientValues.map((c) => c.amountInPeriod).sort((a, b) => a - b);
    const vipThreshold = amounts.length
      ? amounts[Math.max(0, Math.floor(amounts.length * 0.9) - 1)]
      : 0;

    clientValues.forEach((c) => {
      c.frequency = classifyFrequency({
        isNewClient: c.isNewClient,
        ordersInPeriod: c.ordersInPeriod,
        amountInPeriod: c.amountInPeriod,
        vipThreshold,
      });
      c.averageTicket = c.ordersInPeriod > 0 ? round2(c.amountInPeriod / c.ordersInPeriod) : 0;
    });

    const newClients = clientValues.filter((c) => c.isNewClient).length;
    const recurringClients = clientValues.filter((c) => !c.isNewClient).length;

    const sellerAgg = new Map();
    sales.forEach((sale) => {
      const key = sale.sellerId || 'none';
      if (!sellerAgg.has(key)) {
        sellerAgg.set(key, {
          sellerId: sale.sellerId,
          sellerName: sale.sellerName,
          orders: 0,
          revenue: 0,
          clients: new Set(),
        });
      }
      const s = sellerAgg.get(key);
      s.orders += 1;
      s.revenue = round2(s.revenue + sale.revenue);
      s.clients.add(sale.clientId);
    });

    const sellers = [...sellerAgg.values()]
      .map((s) => ({
        sellerId: s.sellerId,
        seller: s.sellerName,
        orders: s.orders,
        clientsServed: s.clients.size,
        revenue: s.revenue,
        averageTicket: s.orders > 0 ? round2(s.revenue / s.orders) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const products = productRows.map((row) => {
      const quantitySold = toNumber(row.quantitySold);
      const revenue = round2(row.revenue);
      return {
        productId: row.productId,
        product: row.product,
        quantitySold,
        revenue,
        averagePrice: quantitySold > 0 ? round2(revenue / quantitySold) : 0,
        clientsServed: toNumber(row.clientsServed),
      };
    });

    const bestSeller = sellers[0] || null;
    const topProduct = products[0] || null;
    const topClient = [...clientValues].sort((a, b) => b.amountInPeriod - a.amountInPeriod)[0] || null;

    const months = listMonthsInRange(start, end);
    const monthlyEvolution = months.map((m) => {
      const monthStart = new Date(m.year, m.month - 1, 1);
      const monthEnd = new Date(m.year, m.month, 0, 23, 59, 59, 999);
      const monthSales = sales.filter((s) => s.date >= monthStart && s.date <= monthEnd);
      const monthClientIds = new Set(monthSales.map((s) => s.clientId));
      let newInMonth = 0;
      let recurringInMonth = 0;
      monthClientIds.forEach((clientId) => {
        const life = lifetimeMap.get(clientId);
        if (life && life.firstPurchase >= monthStart && life.firstPurchase <= monthEnd) {
          newInMonth += 1;
        } else {
          recurringInMonth += 1;
        }
      });
      return {
        month: m.label,
        key: m.key,
        newClients: newInMonth,
        recurringClients: recurringInMonth,
        orders: monthSales.length,
        revenue: round2(monthSales.reduce((acc, s) => acc + s.revenue, 0)),
      };
    });

    const charts = {
      salesEvolution: monthlyEvolution.map((m) => ({
        period: m.month,
        revenue: m.revenue,
        orders: m.orders,
      })),
      newClientsByMonth: monthlyEvolution.map((m) => ({
        period: m.month,
        newClients: m.newClients,
      })),
      topProducts: products.slice(0, 10).map((p) => ({
        product: p.product,
        quantitySold: p.quantitySold,
        revenue: p.revenue,
      })),
      sellerRanking: sellers.slice(0, 15).map((s) => ({
        seller: s.seller,
        revenue: s.revenue,
        orders: s.orders,
      })),
    };

    const strategic = {
      newClientRate: pct(newClients, clientsServed),
      averageTicket: totalOrders > 0 ? round2(totalRevenue / totalOrders) : 0,
      repurchaseRate: pct(recurringClients, clientsServed),
      averageRevenuePerClient: clientsServed > 0 ? round2(totalRevenue / clientsServed) : 0,
    };

    return {
      period,
      filters: filterOptions,
      summary: {
        sales: {
          totalRevenue,
          totalOrders,
          totalItems,
          averageTicket: strategic.averageTicket,
        },
        clients: {
          newClients,
          recurringClients,
          clientsServed,
        },
        commercial: {
          bestSeller: bestSeller ? { name: bestSeller.seller, revenue: bestSeller.revenue } : null,
          topProduct: topProduct ? { name: topProduct.product, quantitySold: topProduct.quantitySold } : null,
          topClient: topClient ? { name: topClient.clientName, revenue: topClient.amountInPeriod } : null,
        },
      },
      strategic,
      clientsReport: clientValues
        .sort((a, b) => b.amountInPeriod - a.amountInPeriod)
        .map((c) => ({
          clientId: c.clientId,
          client: c.clientName,
          firstPurchase: c.firstPurchase.toISOString(),
          isNewClient: c.isNewClient,
          orders: c.ordersInPeriod,
          amount: c.amountInPeriod,
          quantity: c.quantityInPeriod,
          averageTicket: c.averageTicket,
        })),
      productsReport: products,
      sellersReport: sellers,
      purchasesByClient: clientValues
        .sort((a, b) => b.amountInPeriod - a.amountInPeriod)
        .map((c) => ({
          clientId: c.clientId,
          client: c.clientName,
          lastPurchase: c.lastPurchase.toISOString(),
          firstPurchase: c.firstPurchase.toISOString(),
          frequency: c.frequency,
          totalPurchased: c.amountInPeriod,
          orders: c.ordersInPeriod,
        })),
      monthlyEvolution,
      charts,
      consolidated: {
        salesCount: sales.length,
        clientsCount: clientAgg.size,
        productsCount: products.length,
        sellersCount: sellers.length,
      },
    };
  },

  async getFilterOptions(companyId) {
    const [cities, states] = await Promise.all([
      prisma.$queryRaw`
        SELECT DISTINCT c.city AS name
        FROM "Client" c
        WHERE c."companyId" = ${companyId} AND c.city IS NOT NULL AND c.city <> ''
        ORDER BY c.city ASC
      `,
      prisma.$queryRaw`
        SELECT DISTINCT c.state AS name
        FROM "Client" c
        WHERE c."companyId" = ${companyId} AND c.state IS NOT NULL AND c.state <> ''
        ORDER BY c.state ASC
      `,
    ]);

    return {
      cities: cities.map((c) => c.name),
      states: states.map((s) => s.name),
    };
  },
};
