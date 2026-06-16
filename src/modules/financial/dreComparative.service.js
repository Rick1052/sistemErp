import prisma from '../../database/prisma.js';
import { Prisma } from '@prisma/client';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function parseEndDate(endDate) {
  const d = new Date(endDate);
  d.setHours(23, 59, 59, 999);
  return d;
}

function resolvePeriod({ startDate, endDate, year, month }) {
  const now = new Date();
  const y = year ? Number(year) : now.getFullYear();

  if (year && month) {
    const m = Number(month) - 1;
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (year && !startDate && !endDate) {
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), 0, 1);
  const end = endDate ? parseEndDate(endDate) : parseEndDate(new Date(y, 11, 31).toISOString().split('T')[0]);
  return { start, end };
}

function listMonths(start, end) {
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTH_LABELS[cursor.getMonth()]}/${cursor.getFullYear()}`;
    months.push({ key, label, year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function round2(v) {
  return Math.round(Number(v || 0) * 100) / 100;
}

function signedAmount(record, categoryType) {
  const amount = Number(record.amount || 0);
  if (categoryType === 'REVENUE') {
    return record.type === 'RECEIVABLE' ? amount : -amount;
  }
  if (record.type === 'PAYABLE') return amount;
  return -amount;
}

function buildCategoryPaths(categories) {
  const map = {};
  categories.forEach((c) => {
    map[c.id] = { ...c };
  });

  const getMeta = (categoryId) => {
    const path = [];
    let cur = map[categoryId];
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? map[cur.parentId] : null;
    }
    if (!path.length) {
      return { grupo: 'Outros', subgrupo: 'Geral', conta: null, groupId: null, subgroupId: null };
    }

    const grupo = path[0].name;
    const groupId = path[0].id;
    const subgrupo = path.length > 1 ? path[1].name : path[0].name;
    const subgroupId = path.length > 1 ? path[1].id : path[0].id;
    const conta = path.length > 2 ? path[path.length - 1].name : null;

    return { grupo, subgrupo, conta, groupId, subgroupId, categoryId };
  };

  return { map, getMeta };
}

function emptyMonthMap(months) {
  const values = {};
  months.forEach((m) => {
    values[m.key] = 0;
  });
  values.total = 0;
  return values;
}

function addToValues(target, source) {
  Object.keys(source).forEach((k) => {
    target[k] = round2((target[k] || 0) + (source[k] || 0));
  });
}

function classifyExpenseGroup(grupoName) {
  const n = grupoName.toLowerCase();
  if (n.includes('custo')) return 'CUSTOS';
  if (n.includes('dedu') || n.includes('imposto sobre venda')) return 'DEDUCOES';
  if (n.includes('financeir')) return 'RESULTADO_FINANCEIRO';
  return 'DESPESAS';
}

function resolveRevenueGroup(categories) {
  const roots = categories.filter(
    (c) => !c.parentId && c.type === 'REVENUE' && classifyExpenseGroup(c.name) !== 'DEDUCOES'
  );
  return roots[0] || { id: 'sales-revenue', name: 'Receitas' };
}

function shouldIncludeSalesRevenue(categories, query) {
  if (query.subgroupId) return false;
  if (!query.groupId) return true;
  const group = categories.find((c) => c.id === query.groupId);
  if (!group) return true;
  return group.type === 'REVENUE' && classifyExpenseGroup(group.name) !== 'DEDUCOES';
}

async function fetchSalesRevenue(companyId, start, end) {
  const salesByCategory = await prisma.$queryRaw`
    SELECT
      TO_CHAR(DATE_TRUNC('month', s.date), 'YYYY-MM') AS month,
      COALESCE(pc.id::text, 'uncategorized') AS "categoryId",
      COALESCE(pc.name, 'Vendas') AS "categoryName",
      COALESCE(SUM(si.total), 0)::float AS amount
    FROM "SaleItem" si
    INNER JOIN "Sale" s ON s.id = si."saleId"
    INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
    INNER JOIN "Product" p ON p.id = si."productId"
    LEFT JOIN "Category" pc ON pc.id = p."categoryId"
    WHERE s."companyId" = ${companyId}
      AND s.date >= ${start}
      AND s.date <= ${end}
      AND UPPER(ss.name) NOT LIKE '%CANCELAD%'
    GROUP BY DATE_TRUNC('month', s.date), pc.id, pc.name
  `;

  const salesTotals = await prisma.$queryRaw`
    SELECT
      TO_CHAR(DATE_TRUNC('month', s.date), 'YYYY-MM') AS month,
      COALESCE(SUM(s.total), 0)::float AS amount
    FROM "Sale" s
    INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
    WHERE s."companyId" = ${companyId}
      AND s.date >= ${start}
      AND s.date <= ${end}
      AND UPPER(ss.name) NOT LIKE '%CANCELAD%'
    GROUP BY DATE_TRUNC('month', s.date)
  `;

  return { salesByCategory, salesTotals };
}

function appendSalesToConsolidated(consolidated, { salesByCategory, salesTotals }, revenueGroup) {
  const itemsSumByMonth = {};

  salesByCategory.forEach((row) => {
    const valor = round2(row.amount);
    if (!valor) return;

    itemsSumByMonth[row.month] = round2((itemsSumByMonth[row.month] || 0) + valor);

    consolidated.push({
      grupo: revenueGroup.name,
      subgrupo: row.categoryName,
      conta: null,
      groupId: revenueGroup.id,
      subgroupId: `sale-cat:${row.categoryId}`,
      categoryId: `sale-cat:${row.categoryId}`,
      mes: row.month,
      valor,
      categoryType: 'REVENUE',
    });
  });

  salesTotals.forEach((row) => {
    const total = round2(row.amount);
    const itemsTotal = round2(itemsSumByMonth[row.month] || 0);
    const adjustment = round2(total - itemsTotal);
    if (!adjustment) return;

    consolidated.push({
      grupo: revenueGroup.name,
      subgrupo: 'Frete, descontos e ajustes',
      conta: null,
      groupId: revenueGroup.id,
      subgroupId: 'sale-adjustments',
      categoryId: 'sale-adjustments',
      mes: row.month,
      valor: adjustment,
      categoryType: 'REVENUE',
    });
  });
}

export const dreComparativeService = {
  resolvePeriod,
  listMonths,

  async getComparativeDRE(companyId, query = {}) {
    const { start, end } = resolvePeriod(query);
    const months = listMonths(start, end);

    const categories = await prisma.financialCategory.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { cod: 'asc' },
    });

    const { map: categoryMap, getMeta } = buildCategoryPaths(categories);
    const revenueGroup = resolveRevenueGroup(categories);

    const [aggregated, salesData] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          fc.id AS "categoryId",
          fc.name AS "categoryName",
          fc.type AS "categoryType",
          fc."parentId" AS "parentId",
          TO_CHAR(DATE_TRUNC('month', fr."paymentDate"), 'YYYY-MM') AS month,
          fr.type AS "recordType",
          COALESCE(SUM(fr.amount), 0)::float AS amount
        FROM "FinancialRecord" fr
        INNER JOIN "FinancialCategory" fc ON fc.id = fr."categoryId"
        WHERE fr."companyId" = ${companyId}
          AND fr.status = 'PAID'
          AND fr."paymentDate" IS NOT NULL
          AND fr."paymentDate" >= ${start}
          AND fr."paymentDate" <= ${end}
          AND fr."categoryId" IS NOT NULL
          AND fc.type = 'EXPENSE'
        GROUP BY fc.id, fc.name, fc.type, fc."parentId", DATE_TRUNC('month', fr."paymentDate"), fr.type
      `,
      shouldIncludeSalesRevenue(categories, query)
        ? fetchSalesRevenue(companyId, start, end)
        : Promise.resolve({ salesByCategory: [], salesTotals: [] }),
    ]);

    const deductionsAggregated = await prisma.$queryRaw`
      SELECT
        fc.id AS "categoryId",
        fc.name AS "categoryName",
        fc.type AS "categoryType",
        fc."parentId" AS "parentId",
        TO_CHAR(DATE_TRUNC('month', fr."paymentDate"), 'YYYY-MM') AS month,
        fr.type AS "recordType",
        COALESCE(SUM(fr.amount), 0)::float AS amount
      FROM "FinancialRecord" fr
      INNER JOIN "FinancialCategory" fc ON fc.id = fr."categoryId"
      WHERE fr."companyId" = ${companyId}
        AND fr.status = 'PAID'
        AND fr."paymentDate" IS NOT NULL
        AND fr."paymentDate" >= ${start}
        AND fr."paymentDate" <= ${end}
        AND fr."categoryId" IS NOT NULL
        AND fc.type = 'REVENUE'
      GROUP BY fc.id, fc.name, fc.type, fc."parentId", DATE_TRUNC('month', fr."paymentDate"), fr.type
    `;

    const consolidated = [];

    appendSalesToConsolidated(consolidated, salesData, revenueGroup);

    aggregated.forEach((row) => {
      const meta = getMeta(row.categoryId);
      const value = signedAmount(
        { amount: row.amount, type: row.recordType },
        row.categoryType
      );

      if (query.groupId && meta.groupId !== query.groupId) return;
      if (query.subgroupId && meta.subgroupId !== query.subgroupId) return;

      consolidated.push({
        grupo: meta.grupo,
        subgrupo: meta.subgrupo,
        conta: meta.conta,
        groupId: meta.groupId,
        subgroupId: meta.subgroupId,
        categoryId: row.categoryId,
        mes: row.month,
        valor: round2(value),
        categoryType: row.categoryType,
      });
    });

    deductionsAggregated.forEach((row) => {
      const meta = getMeta(row.categoryId);
      if (classifyExpenseGroup(meta.grupo) !== 'DEDUCOES') return;

      const value = signedAmount(
        { amount: row.amount, type: row.recordType },
        row.categoryType
      );

      if (query.groupId && meta.groupId !== query.groupId) return;
      if (query.subgroupId && meta.subgroupId !== query.subgroupId) return;

      consolidated.push({
        grupo: meta.grupo,
        subgrupo: meta.subgrupo,
        conta: meta.conta,
        groupId: meta.groupId,
        subgroupId: meta.subgroupId,
        categoryId: row.categoryId,
        mes: row.month,
        valor: round2(value),
        categoryType: row.categoryType,
      });
    });

    const accountRows = new Map();

    consolidated.forEach((item) => {
      const rowKey = item.conta
        ? `account:${item.categoryId}`
        : `subgroup:${item.groupId}:${item.subgroupId}`;

      if (!accountRows.has(rowKey)) {
        accountRows.set(rowKey, {
          id: rowKey,
          rowType: item.conta ? 'account' : 'subgroup',
          grupo: item.grupo,
          subgrupo: item.subgrupo,
          conta: item.conta,
          groupId: item.groupId,
          subgroupId: item.subgroupId,
          categoryId: item.categoryId,
          categoryType: item.categoryType,
          values: emptyMonthMap(months),
        });
      }

      const row = accountRows.get(rowKey);
      row.values[item.mes] = round2((row.values[item.mes] || 0) + item.valor);
      row.values.total = round2((row.values.total || 0) + item.valor);
    });

    const subgroupMap = new Map();
    accountRows.forEach((row) => {
      const sgKey = `${row.groupId}:${row.subgroupId}`;
      if (!subgroupMap.has(sgKey)) {
        subgroupMap.set(sgKey, {
          id: `subgroup:${sgKey}`,
          rowType: 'subgroup',
          grupo: row.grupo,
          subgrupo: row.subgrupo,
          conta: null,
          groupId: row.groupId,
          subgroupId: row.subgroupId,
          categoryType: row.categoryType,
          values: emptyMonthMap(months),
          children: [],
        });
      }
      const sg = subgroupMap.get(sgKey);
      if (row.rowType === 'account') {
        sg.children.push(row);
      }
      addToValues(sg.values, row.values);
    });

    const groupMap = new Map();
    subgroupMap.forEach((sg) => {
      const gKey = sg.groupId;
      if (!groupMap.has(gKey)) {
        groupMap.set(gKey, {
          id: `group:${gKey}`,
          rowType: 'group',
          grupo: sg.grupo,
          subgrupo: null,
          conta: null,
          groupId: sg.groupId,
          categoryType: sg.categoryType,
          values: emptyMonthMap(months),
          children: [],
        });
      }
      const group = groupMap.get(gKey);
      group.children.push(sg);
      addToValues(group.values, sg.values);
    });

    const tableRows = [];

    const sortedGroups = [...groupMap.values()].sort((a, b) => {
      if (a.categoryType !== b.categoryType) {
        return a.categoryType === 'REVENUE' ? -1 : 1;
      }
      return a.grupo.localeCompare(b.grupo);
    });

    sortedGroups.forEach((group) => {
      group.children.sort((a, b) => a.subgrupo.localeCompare(b.subgrupo));
      group.children.forEach((sg) => {
        sg.children.sort((a, b) => (a.conta || '').localeCompare(b.conta || ''));
        if (sg.children.length > 0) {
          tableRows.push({
            ...sg,
            rowType: 'subgroup',
            expandable: true,
          });
          sg.children.forEach((acc) => {
            tableRows.push({ ...acc, rowType: 'account', indent: 2 });
          });
        } else {
          tableRows.push({ ...sg, rowType: 'subgroup', expandable: false });
        }
      });

      tableRows.push({
        id: `total-group:${group.groupId}`,
        rowType: 'group_total',
        grupo: `TOTAL ${group.grupo.toUpperCase()}`,
        subgrupo: null,
        conta: null,
        values: group.values,
        isBold: true,
      });
    });

    const sumByType = (type, expenseClass = null) => {
      const values = emptyMonthMap(months);
      sortedGroups
        .filter((g) => g.categoryType === type)
        .filter((g) => !expenseClass || classifyExpenseGroup(g.grupo) === expenseClass)
        .forEach((g) => addToValues(values, g.values));
      return values;
    };

    const deductions = emptyMonthMap(months);
    sortedGroups
      .filter((g) => g.categoryType === 'REVENUE' && classifyExpenseGroup(g.grupo) === 'DEDUCOES')
      .forEach((g) => addToValues(deductions, g.values));

    const revenueWithoutDeductions = emptyMonthMap(months);
    sortedGroups
      .filter((g) => g.categoryType === 'REVENUE' && classifyExpenseGroup(g.grupo) !== 'DEDUCOES')
      .forEach((g) => addToValues(revenueWithoutDeductions, g.values));

    const costs = sumByType('EXPENSE', 'CUSTOS');

    const operatingExpenses = emptyMonthMap(months);
    sortedGroups
      .filter((g) => g.categoryType === 'EXPENSE' && classifyExpenseGroup(g.grupo) === 'DESPESAS')
      .forEach((g) => addToValues(operatingExpenses, g.values));

    const financialResult = sumByType('EXPENSE', 'RESULTADO_FINANCEIRO');

    const subtractValues = (a, b) => {
      const out = emptyMonthMap(months);
      months.forEach((m) => {
        out[m.key] = round2((a[m.key] || 0) - (b[m.key] || 0));
      });
      out.total = round2((a.total || 0) - (b.total || 0));
      return out;
    };

    const netRevenue = subtractValues(revenueWithoutDeductions, deductions);
    const grossProfit = subtractValues(netRevenue, costs);
    const operatingResult = subtractValues(grossProfit, operatingExpenses);
    const netProfit = subtractValues(operatingResult, financialResult);

    const indicators = [
      { id: 'ind-gross-revenue', label: 'Receita Bruta', values: revenueWithoutDeductions, rowType: 'indicator' },
      { id: 'ind-deductions', label: 'Deduções', values: deductions, rowType: 'indicator' },
      { id: 'ind-net-revenue', label: 'Receita Líquida', values: netRevenue, rowType: 'indicator', isBold: true },
      { id: 'ind-costs', label: 'Custos', values: costs, rowType: 'indicator' },
      { id: 'ind-gross-profit', label: 'Lucro Bruto', values: grossProfit, rowType: 'indicator', isBold: true },
      { id: 'ind-operating-expenses', label: 'Despesas Operacionais', values: operatingExpenses, rowType: 'indicator' },
      { id: 'ind-operating-result', label: 'Resultado Operacional', values: operatingResult, rowType: 'indicator', isBold: true },
      { id: 'ind-financial-result', label: 'Resultado Financeiro', values: financialResult, rowType: 'indicator' },
      { id: 'ind-net-profit', label: 'Lucro Líquido', values: netProfit, rowType: 'indicator', isBold: true, highlight: true },
    ];

    const chartEvolution = months.map((m) => ({
      period: m.label,
      receita: netRevenue[m.key] || 0,
      custos: costs[m.key] || 0,
      despesas: operatingExpenses[m.key] || 0,
      lucro: netProfit[m.key] || 0,
    }));

    const costParticipation = [];
    sortedGroups
      .filter((g) => g.categoryType === 'EXPENSE' && classifyExpenseGroup(g.grupo) === 'CUSTOS')
      .forEach((g) => {
        g.children.forEach((sg) => {
          costParticipation.push({
            name: sg.subgrupo,
            value: sg.values.total,
          });
        });
      });

    const filterOptions = {
      groups: categories
        .filter((c) => !c.parentId)
        .map((c) => ({ id: c.id, name: c.name, type: c.type })),
      subgroups: categories
        .filter((c) => c.parentId && categoryMap[c.parentId] && !categoryMap[c.parentId].parentId)
        .map((c) => ({
          id: c.id,
          name: c.name,
          groupId: c.parentId,
          groupName: categoryMap[c.parentId]?.name,
        })),
    };

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      months,
      rows: tableRows,
      indicators,
      consolidated,
      summary: {
        grossRevenue: revenueWithoutDeductions.total,
        deductions: deductions.total,
        netRevenue: netRevenue.total,
        costs: costs.total,
        grossProfit: grossProfit.total,
        operatingExpenses: operatingExpenses.total,
        operatingResult: operatingResult.total,
        financialResult: financialResult.total,
        netProfit: netProfit.total,
      },
      charts: {
        evolution: chartEvolution,
        costParticipation: costParticipation.filter((c) => c.value > 0),
        comparative: chartEvolution,
      },
      filters: filterOptions,
    };
  },

  async getDrillDown(companyId, query = {}) {
    const { start: periodStart, end: periodEnd } = resolvePeriod(query);
    const monthKey = query.monthKey || 'total';
    const { start, end } = resolveMonthRange(monthKey, periodStart, periodEnd);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const search = (query.search || '').trim();
    const offset = (page - 1) * limit;

    const categories = await prisma.financialCategory.findMany({
      where: { companyId, status: 'ACTIVE' },
    });
    const { getMeta } = buildCategoryPaths(categories);
    const revenueGroup = resolveRevenueGroup(categories);

    const scope = resolveDrillScope(query, revenueGroup);
    const breadcrumb = buildBreadcrumb(query, scope, monthKey, categories);

    const { items, total, totalAmount } = await fetchDrillItems({
      companyId,
      start,
      end,
      scope,
      categories,
      getMeta,
      revenueGroup,
      search,
      offset,
      limit,
    });

    return {
      breadcrumb,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      monthKey,
      monthLabel: monthKey === 'total' ? 'Período completo' : formatMonthLabel(monthKey),
      summary: { total, totalAmount: round2(totalAmount), page, limit },
      items,
    };
  },
};

function resolveMonthRange(monthKey, periodStart, periodEnd) {
  if (!monthKey || monthKey === 'total') {
    return { start: periodStart, end: periodEnd };
  }
  const [y, m] = monthKey.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]}/${y}`;
}

function resolveDrillScope(query, revenueGroup) {
  if (query.indicatorId) {
    return { kind: 'indicator', indicatorId: query.indicatorId };
  }

  const groupId = query.groupId || null;
  const subgroupId = query.subgroupId || null;
  const categoryId = query.categoryId || null;
  const rowType = query.rowType || null;

  if (rowType === 'group_total' && query.rowId?.startsWith('total-group:')) {
    return {
      kind: 'financial',
      groupId: query.rowId.replace('total-group:', ''),
      subgroupId: null,
      categoryId: null,
    };
  }

  const isSales =
    groupId === revenueGroup.id ||
    groupId === 'sales-revenue' ||
    (subgroupId && String(subgroupId).startsWith('sale-')) ||
    (categoryId && String(categoryId).startsWith('sale-'));

  if (isSales) {
    return {
      kind: 'sales',
      groupId: revenueGroup.id,
      subgroupId,
      categoryId,
      saleCategoryId: subgroupId?.startsWith('sale-cat:')
        ? subgroupId.replace('sale-cat:', '')
        : categoryId?.startsWith('sale-cat:')
          ? categoryId.replace('sale-cat:', '')
          : subgroupId === 'sale-adjustments' || categoryId === 'sale-adjustments'
            ? 'adjustments'
            : null,
    };
  }

  return { kind: 'financial', groupId, subgroupId, categoryId };
}

function buildBreadcrumb(query, scope, monthKey, categories) {
  const parts = [{ label: 'DRE', level: 'dre' }];

  if (query.indicatorId && query.indicatorLabel) {
    parts.push({ label: query.indicatorLabel, level: 'indicator' });
  } else {
    if (query.grupo) parts.push({ label: query.grupo, level: 'group' });
    if (query.subgrupo) parts.push({ label: query.subgrupo, level: 'subgroup' });
    if (query.conta) parts.push({ label: query.conta, level: 'account' });
  }

  parts.push({
    label: monthKey === 'total' ? 'Período completo' : formatMonthLabel(monthKey),
    level: 'month',
  });

  return parts;
}

function categoryIdsForScope(categories, getMeta, scope) {
  if (scope.categoryId && !String(scope.categoryId).startsWith('sale-')) {
    return [scope.categoryId];
  }

  const ids = [];
  categories.forEach((cat) => {
    const meta = getMeta(cat.id);
    if (scope.subgroupId && meta.subgroupId === scope.subgroupId) ids.push(cat.id);
    else if (scope.groupId && meta.groupId === scope.groupId) ids.push(cat.id);
  });

  return [...new Set(ids)];
}

function categoryIdsForIndicator(indicatorId, categories, getMeta) {
  const ids = [];
  categories.forEach((cat) => {
    const meta = getMeta(cat.id);
    const expenseClass = classifyExpenseGroup(meta.grupo);

    switch (indicatorId) {
      case 'ind-gross-revenue':
        if (cat.type === 'REVENUE' && expenseClass !== 'DEDUCOES') ids.push(cat.id);
        break;
      case 'ind-deductions':
        if (cat.type === 'REVENUE' && expenseClass === 'DEDUCOES') ids.push(cat.id);
        break;
      case 'ind-costs':
        if (cat.type === 'EXPENSE' && expenseClass === 'CUSTOS') ids.push(cat.id);
        break;
      case 'ind-operating-expenses':
        if (cat.type === 'EXPENSE' && expenseClass === 'DESPESAS') ids.push(cat.id);
        break;
      case 'ind-financial-result':
        if (cat.type === 'EXPENSE' && expenseClass === 'RESULTADO_FINANCEIRO') ids.push(cat.id);
        break;
      case 'ind-net-revenue':
        if (cat.type === 'REVENUE') ids.push(cat.id);
        break;
      case 'ind-gross-profit':
      case 'ind-operating-result':
      case 'ind-net-profit':
        ids.push(cat.id);
        break;
      default:
        break;
    }
  });
  return [...new Set(ids)];
}

function indicatorIncludesSales(indicatorId) {
  return [
    'ind-gross-revenue',
    'ind-net-revenue',
    'ind-gross-profit',
    'ind-operating-result',
    'ind-net-profit',
  ].includes(indicatorId);
}

async function fetchDrillItems({
  companyId,
  start,
  end,
  scope,
  categories,
  getMeta,
  revenueGroup,
  search,
  offset,
  limit,
}) {
  if (scope.kind === 'sales' || (scope.kind === 'indicator' && indicatorIncludesSales(scope.indicatorId))) {
    const salesItems = await fetchSalesDrillItems({
      companyId,
      start,
      end,
      scope,
      revenueGroup,
      search,
    });
    const financialItems =
      scope.kind === 'indicator'
        ? await fetchFinancialDrillItems({
            companyId,
            start,
            end,
            categoryIds: categoryIdsForIndicator(scope.indicatorId, categories, getMeta),
            categories,
            getMeta,
            search,
            fetchAll: true,
          })
        : [];

    const merged = [...salesItems, ...financialItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const totalAmount = merged.reduce((acc, i) => acc + i.amount, 0);
    return {
      items: merged.slice(offset, offset + limit),
      total: merged.length,
      totalAmount,
    };
  }

  let categoryIds = null;
  if (scope.kind === 'indicator') {
    categoryIds = categoryIdsForIndicator(scope.indicatorId, categories, getMeta);
  } else {
    categoryIds = categoryIdsForScope(categories, getMeta, scope);
  }

  return fetchFinancialDrillItems({
    companyId,
    start,
    end,
    categoryIds,
    categories,
    getMeta,
    search,
    offset,
    limit,
  });
}

async function fetchFinancialDrillItems({
  companyId,
  start,
  end,
  categoryIds,
  categories,
  getMeta,
  search,
  offset = 0,
  limit = 25,
  fetchAll = false,
}) {
  const where = {
    companyId,
    status: 'PAID',
    paymentDate: { gte: start, lte: end },
    categoryId: categoryIds?.length ? { in: categoryIds } : { not: null },
  };

  if (search) {
    where.AND = [
      {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { chequeNumber: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ],
      },
    ];
  }

  const [total, records] = await Promise.all([
    prisma.financialRecord.count({ where }),
    prisma.financialRecord.findMany({
      where,
      include: {
        category: true,
        client: true,
        supplier: true,
        sale: { select: { cod: true } },
      },
      orderBy: { paymentDate: 'desc' },
      ...(fetchAll ? {} : { skip: offset, take: limit }),
    }),
  ]);

  const items = records.map((fr) => mapFinancialRecord(fr, getMeta));
  const totalAmount = items.reduce((acc, i) => acc + i.amount, 0);

  if (fetchAll) return items;

  const [sumRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(
      CASE
        WHEN fc.type = 'REVENUE' AND fr.type = 'RECEIVABLE' THEN fr.amount
        WHEN fc.type = 'REVENUE' AND fr.type = 'PAYABLE' THEN -fr.amount
        WHEN fc.type = 'EXPENSE' AND fr.type = 'PAYABLE' THEN fr.amount
        WHEN fc.type = 'EXPENSE' AND fr.type = 'RECEIVABLE' THEN -fr.amount
        ELSE fr.amount
      END
    ), 0)::float AS total
    FROM "FinancialRecord" fr
    LEFT JOIN "FinancialCategory" fc ON fc.id = fr."categoryId"
    WHERE fr."companyId" = ${companyId}
      AND fr.status = 'PAID'
      AND fr."paymentDate" >= ${start}
      AND fr."paymentDate" <= ${end}
      ${categoryIds?.length ? Prisma.sql`AND fr."categoryId" IN (${Prisma.join(categoryIds)})` : Prisma.empty}
  `;

  return {
    items,
    total,
    totalAmount: round2(sumRow?.total || totalAmount),
  };
}

function mapFinancialRecord(fr, getMeta) {
  const meta = fr.categoryId ? getMeta(fr.categoryId) : { grupo: '—', subgrupo: '—', conta: null };
  const categoryType = fr.category?.type || 'EXPENSE';
  const amount = signedAmount({ amount: fr.amount, type: fr.type }, categoryType);

  return {
    id: fr.id,
    sourceType: 'financial',
    date: fr.paymentDate || fr.dueDate,
    document: fr.sale?.cod ? `Pedido #${fr.sale.cod}` : `LANÇ-${fr.cod}`,
    invoiceNumber: fr.chequeNumber || null,
    supplier: fr.supplier?.name || null,
    client: fr.client?.name || null,
    grupo: meta.grupo,
    subgrupo: meta.subgrupo,
    conta: meta.conta,
    costCenter: null,
    description: fr.description,
    user: null,
    amount: round2(amount),
  };
}

async function fetchSalesDrillItems({ companyId, start, end, scope, revenueGroup, search }) {
  const saleCategoryId = scope.saleCategoryId;
  const searchSql = search
    ? Prisma.sql`AND (
        c.name ILIKE ${`%${search}%`}
        OR p.description ILIKE ${`%${search}%`}
        OR s.cod::text ILIKE ${`%${search}%`}
      )`
    : Prisma.empty;

  if (saleCategoryId === 'adjustments') {
    const rows = await prisma.$queryRaw`
      SELECT
        s.id,
        s.cod,
        s.date,
        c.name AS "clientName",
        (s.total - COALESCE((SELECT SUM(si.total) FROM "SaleItem" si WHERE si."saleId" = s.id), 0))::float AS amount
      FROM "Sale" s
      INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
      INNER JOIN "Client" c ON c.id = s."clientId"
      WHERE s."companyId" = ${companyId}
        AND s.date >= ${start}
        AND s.date <= ${end}
        AND UPPER(ss.name) NOT LIKE '%CANCELAD%'
        AND ABS(s.total - COALESCE((SELECT SUM(si.total) FROM "SaleItem" si WHERE si."saleId" = s.id), 0)) > 0.009
        ${searchSql}
      ORDER BY s.date DESC
    `;

    return rows.map((s) => ({
      id: s.id,
      sourceType: 'sale',
      date: s.date,
      document: `Pedido #${s.cod}`,
      invoiceNumber: null,
      supplier: null,
      client: s.clientName,
      grupo: revenueGroup.name,
      subgrupo: 'Frete, descontos e ajustes',
      conta: null,
      costCenter: null,
      description: 'Ajuste de frete, desconto ou arredondamento',
      user: null,
      amount: round2(s.amount),
    }));
  }

  const categoryFilter =
    saleCategoryId && saleCategoryId !== 'uncategorized'
      ? Prisma.sql`AND pc.id::text = ${saleCategoryId}`
      : saleCategoryId === 'uncategorized'
        ? Prisma.sql`AND pc.id IS NULL`
        : Prisma.empty;

  const rows = await prisma.$queryRaw`
    SELECT
      s.id AS "saleId",
      s.cod,
      s.date,
      si.total::float AS amount,
      si.quantity,
      p.description AS product,
      COALESCE(pc.name, 'Vendas') AS "categoryName",
      c.name AS "clientName"
    FROM "SaleItem" si
    INNER JOIN "Sale" s ON s.id = si."saleId"
    INNER JOIN "SaleStatus" ss ON ss.id = s."statusId"
    INNER JOIN "Product" p ON p.id = si."productId"
    INNER JOIN "Client" c ON c.id = s."clientId"
    LEFT JOIN "Category" pc ON pc.id = p."categoryId"
    WHERE s."companyId" = ${companyId}
      AND s.date >= ${start}
      AND s.date <= ${end}
      AND UPPER(ss.name) NOT LIKE '%CANCELAD%'
      ${categoryFilter}
      ${searchSql}
    ORDER BY s.date DESC
  `;

  return rows.map((row) => ({
    id: `${row.saleId}-${row.product}`,
    sourceType: 'sale',
    date: row.date,
    document: `Pedido #${row.cod}`,
    invoiceNumber: null,
    supplier: null,
    client: row.clientName,
    grupo: revenueGroup.name,
    subgrupo: row.categoryName,
    conta: row.product,
    costCenter: null,
    description: `Venda ${row.quantity} un. — ${row.product}`,
    user: null,
    amount: round2(row.amount),
  }));
}
