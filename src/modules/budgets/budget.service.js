import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';
import { parseDateInput } from '../../utils/date.js';
import { saleService } from '../sales/sale.service.js';
import logger from '../../utils/logger.js';
import {
  BUDGET_HISTORY_ACTIONS,
  BUDGET_STATUS_LABELS,
  TERMINAL_STATUSES,
} from './budget.constants.js';

const budgetInclude = {
  client: { select: { id: true, name: true, document: true, email: true, phone: true, street: true, number: true, city: true, state: true, zipCode: true } },
  seller: { select: { id: true, name: true, email: true } },
  paymentMethod: { select: { id: true, name: true } },
  convertedSale: { select: { id: true, cod: true, total: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          cod: true,
          code: true,
          description: true,
          price: true,
          physicalStock: true,
          reservedStock: true,
        },
      },
    },
    orderBy: { cod: 'asc' },
  },
  history: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  },
};

function calcTotals(items, discount = 0, freight = 0) {
  let subtotal = 0;
  for (const item of items) {
    const itemTotal = (Number(item.unitPrice) - Number(item.discount || 0)) * Number(item.quantity);
    subtotal += itemTotal;
  }
  const total = subtotal - Number(discount) + Number(freight);
  return { subtotal, discount: Number(discount), freight: Number(freight), total };
}

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

async function addHistory(tx, budgetId, userId, action, message) {
  return tx.budgetHistory.create({
    data: { budgetId, userId: userId || null, action, message },
  });
}

async function expireOverdueBudgets(companyId, tx = prisma) {
  const today = startOfDay(new Date());
  const overdue = await tx.budget.findMany({
    where: {
      companyId,
      validUntil: { lt: today },
      status: { notIn: TERMINAL_STATUSES },
    },
    select: { id: true, cod: true },
  });

  for (const b of overdue) {
    await tx.budget.update({
      where: { id: b.id },
      data: { status: 'EXPIRED' },
    });
    await addHistory(
      tx,
      b.id,
      null,
      BUDGET_HISTORY_ACTIONS.EXPIRED,
      `Orçamento nº ${b.cod} expirado automaticamente`
    );
  }
}

export const budgetService = {
  async list(companyId, {
    page = 1,
    limit = 25,
    startDate,
    endDate,
    search,
    status,
    clientId,
    sellerId,
    cod,
  }) {
    await expireOverdueBudgets(companyId);

    const skip = (page - 1) * limit;
    const where = { companyId };

    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (sellerId) where.sellerId = sellerId;

    if (cod) {
      const n = Number(cod);
      if (Number.isFinite(n)) where.cod = n;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startOfDay(parseDateInput(startDate));
      if (endDate) where.date.lte = endOfDay(parseDateInput(endDate));
    }

    if (search) {
      const s = String(search).trim();
      const onlyDigits = s.replace(/\D/g, '');
      const n = Number(onlyDigits || s);
      where.OR = [
        { client: { is: { name: { contains: s, mode: 'insensitive' } } } },
        { client: { is: { document: { contains: onlyDigits || s, mode: 'insensitive' } } } },
      ];
      if (Number.isFinite(n) && !Number.isNaN(n)) {
        where.OR.push({ cod: n });
      }
    }

    const [total, budgets] = await Promise.all([
      prisma.budget.count({ where }),
      prisma.budget.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true } },
          convertedSale: { select: { id: true, cod: true } },
        },
        orderBy: { cod: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      budgets: budgets.map((b) => ({
        ...b,
        statusLabel: BUDGET_STATUS_LABELS[b.status] || b.status,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  },

  async getById(companyId, id, tx = null) {
    const client = tx || prisma;
    if (!tx) {
      await expireOverdueBudgets(companyId, client);
    }

    const budget = await client.budget.findFirst({
      where: { id, companyId },
      include: budgetInclude,
    });

    if (!budget) throw new AppError('Orçamento não encontrado', 404);

    return {
      ...budget,
      statusLabel: BUDGET_STATUS_LABELS[budget.status] || budget.status,
    };
  },

  async create(companyId, userId, data) {
    const {
      items,
      discount = 0,
      freight = 0,
      clientId,
      sellerId,
      status = 'DRAFT',
      date,
      validUntil,
      notes,
      paymentTerms,
      paymentMethodId,
      leadOrigin,
      competitor,
      lossReason,
      commercialNotes,
    } = data;

    const totals = calcTotals(items, discount, freight);

    try {
      const budgetId = await prisma.$transaction(async (tx) => {
        const budget = await createWithSequence(
          'budget',
          companyId,
          {
            clientId,
            sellerId: sellerId || userId,
            status,
            date: date ? parseDateInput(date) : new Date(),
            validUntil: validUntil ? parseDateInput(validUntil) : null,
            subtotal: totals.subtotal,
            discount: totals.discount,
            freight: totals.freight,
            total: totals.total,
            notes,
            paymentTerms,
            paymentMethodId: paymentMethodId || null,
            leadOrigin,
            competitor,
            lossReason,
            commercialNotes,
          },
          tx
        );

        for (const item of items) {
          const itemTotal = (item.unitPrice - (item.discount || 0)) * item.quantity;
          await createWithSequence(
            'budgetItem',
            companyId,
            {
              budgetId: budget.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: itemTotal,
            },
            tx
          );
        }

        await addHistory(
          tx,
          budget.id,
          userId,
          BUDGET_HISTORY_ACTIONS.CREATED,
          `Orçamento nº ${budget.cod} criado`
        );

        return budget.id;
      });

      return budgetService.getById(companyId, budgetId);
    } catch (error) {
      logger.error({
        msg: 'ERRO CRÍTICO NA CRIAÇÃO DE ORÇAMENTO',
        error: error.message,
        code: error.code,
        stack: error.stack,
        companyId,
        userId,
      });
      throw error;
    }
  },

  async update(companyId, userId, id, data) {
    const existing = await prisma.budget.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError('Orçamento não encontrado', 404);
    if (existing.status === 'CONVERTED') {
      throw new AppError('Orçamento convertido em venda não pode ser alterado', 400);
    }

    const {
      items,
      discount = 0,
      freight = 0,
      clientId,
      sellerId,
      date,
      validUntil,
      notes,
      paymentTerms,
      paymentMethodId,
      leadOrigin,
      competitor,
      lossReason,
      commercialNotes,
    } = data;

    const totals = calcTotals(items, discount, freight);

    await prisma.$transaction(async (tx) => {
      await tx.budgetItem.deleteMany({ where: { budgetId: id, companyId } });

      await tx.budget.update({
        where: { id },
        data: {
          clientId,
          sellerId,
          date: date ? parseDateInput(date) : existing.date,
          validUntil: validUntil ? parseDateInput(validUntil) : null,
          subtotal: totals.subtotal,
          discount: totals.discount,
          freight: totals.freight,
          total: totals.total,
          notes,
          paymentTerms,
          paymentMethodId: paymentMethodId || null,
          leadOrigin,
          competitor,
          lossReason,
          commercialNotes,
        },
      });

      for (const item of items) {
        const itemTotal = (item.unitPrice - (item.discount || 0)) * item.quantity;
        await createWithSequence(
          'budgetItem',
          companyId,
          {
            budgetId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            total: itemTotal,
          },
          tx
        );
      }

      await addHistory(
        tx,
        id,
        userId,
        BUDGET_HISTORY_ACTIONS.UPDATED,
        `Orçamento nº ${existing.cod} alterado`
      );
    });

    return budgetService.getById(companyId, id);
  },

  async updateStatus(companyId, userId, id, { status, lossReason, commercialNotes }) {
    const existing = await prisma.budget.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError('Orçamento não encontrado', 404);
    if (existing.status === 'CONVERTED') {
      throw new AppError('Orçamento já convertido em venda', 400);
    }

    const data = { status };
    if (status === 'SENT') data.sentAt = new Date();
    if (status === 'NEGOTIATION') data.lastFollowUpAt = new Date();
    if (lossReason !== undefined) data.lossReason = lossReason;
    if (commercialNotes !== undefined) data.commercialNotes = commercialNotes;

    await prisma.$transaction(async (tx) => {
      await tx.budget.update({ where: { id }, data });

      const label = BUDGET_STATUS_LABELS[status] || status;
      let action = BUDGET_HISTORY_ACTIONS.STATUS_CHANGED;
      let message = `Status alterado para ${label}`;

      if (status === 'SENT') {
        action = BUDGET_HISTORY_ACTIONS.SENT;
        message = 'Enviado para cliente';
      } else if (status === 'APPROVED') {
        action = BUDGET_HISTORY_ACTIONS.APPROVED;
        message = 'Orçamento aprovado';
      } else if (status === 'REJECTED') {
        action = BUDGET_HISTORY_ACTIONS.REJECTED;
        message = lossReason ? `Orçamento rejeitado: ${lossReason}` : 'Orçamento rejeitado';
      }

      await addHistory(tx, id, userId, action, message);
    });

    return budgetService.getById(companyId, id);
  },

  async delete(companyId, id) {
    const existing = await prisma.budget.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError('Orçamento não encontrado', 404);
    if (existing.status === 'CONVERTED') {
      throw new AppError('Orçamento convertido não pode ser excluído', 400);
    }

    await prisma.budget.delete({ where: { id } });
    return { message: 'Orçamento excluído com sucesso' };
  },

  async convertToSale(companyId, userId, id) {
    const budget = await budgetService.getById(companyId, id);
    if (budget.status === 'CONVERTED') {
      throw new AppError('Orçamento já foi convertido em venda', 400);
    }
    if (budget.status === 'REJECTED' || budget.status === 'EXPIRED') {
      throw new AppError('Orçamento rejeitado ou expirado não pode ser convertido', 400);
    }

    const defaultStatus = await prisma.saleStatus.findFirst({
      where: { companyId, stockAction: 'NONE' },
      orderBy: { cod: 'asc' },
    });
    if (!defaultStatus) {
      throw new AppError('Nenhum status de venda disponível para conversão', 400);
    }

    const saleData = {
      clientId: budget.clientId,
      statusId: defaultStatus.id,
      paymentMethodId: budget.paymentMethodId || undefined,
      date: new Date().toISOString().slice(0, 10),
      discount: Number(budget.discount),
      freight: Number(budget.freight),
      items: budget.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
      })),
    };

    const sale = await saleService.create(companyId, userId, saleData);

    await prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id },
        data: { status: 'CONVERTED', convertedSaleId: sale.id },
      });
      await addHistory(
        tx,
        id,
        userId,
        BUDGET_HISTORY_ACTIONS.CONVERTED,
        `Convertido em venda nº ${sale.cod}`
      );
    });

    return budgetService.getById(companyId, id);
  },

  async getDashboard(companyId, { noResponseDays = 7 } = {}) {
    await expireOverdueBudgets(companyId);

    const budgets = await prisma.budget.findMany({
      where: { companyId },
      select: {
        id: true,
        cod: true,
        status: true,
        total: true,
        validUntil: true,
        updatedAt: true,
        sentAt: true,
        client: { select: { name: true } },
        convertedSale: { select: { cod: true, total: true } },
      },
    });

    const totalBudgeted = budgets
      .filter((b) => b.status !== 'REJECTED')
      .reduce((s, b) => s + Number(b.total), 0);

    const converted = budgets.filter((b) => b.status === 'CONVERTED');
    const totalConverted = converted.reduce(
      (s, b) => s + Number(b.convertedSale?.total ?? b.total),
      0
    );

    const totalCount = budgets.length;
    const convertedCount = converted.length;
    const conversionRate = totalCount > 0 ? (convertedCount / totalCount) * 100 : 0;

    const openStatuses = ['DRAFT', 'OPEN', 'SENT', 'NEGOTIATION', 'APPROVED'];
    const openCount = budgets.filter((b) => openStatuses.includes(b.status)).length;
    const lostCount = budgets.filter((b) => b.status === 'REJECTED').length;

    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const expiringToday = budgets.filter(
      (b) =>
        b.validUntil &&
        b.validUntil >= today &&
        b.validUntil < tomorrow &&
        !TERMINAL_STATUSES.includes(b.status)
    );

    const expired = budgets.filter((b) => b.status === 'EXPIRED');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(noResponseDays));
    const noResponse = budgets.filter(
      (b) =>
        ['SENT', 'NEGOTIATION'].includes(b.status) &&
        b.updatedAt < cutoff
    );

    const funnel = [
      { step: 'CREATED', label: 'Orçamentos Criados', count: totalCount },
      {
        step: 'SENT',
        label: 'Enviados',
        count: budgets.filter((b) => ['SENT', 'NEGOTIATION', 'APPROVED', 'CONVERTED'].includes(b.status)).length,
      },
      {
        step: 'NEGOTIATION',
        label: 'Em Negociação',
        count: budgets.filter((b) => ['NEGOTIATION', 'APPROVED', 'CONVERTED'].includes(b.status)).length,
      },
      {
        step: 'APPROVED',
        label: 'Aprovados',
        count: budgets.filter((b) => ['APPROVED', 'CONVERTED'].includes(b.status)).length,
      },
      { step: 'CONVERTED', label: 'Convertidos', count: convertedCount },
    ].map((row, index, arr) => ({
      ...row,
      conversionFromPrevious:
        index === 0 ? 100 : arr[index - 1].count > 0 ? (row.count / arr[index - 1].count) * 100 : 0,
    }));

    const conversionReport = budgets.map((b) => ({
      id: b.id,
      cod: b.cod,
      clientName: b.client?.name || '—',
      budgetTotal: Number(b.total),
      saleTotal: b.convertedSale ? Number(b.convertedSale.total) : null,
      status: b.status,
      statusLabel: BUDGET_STATUS_LABELS[b.status] || b.status,
      saleCod: b.convertedSale?.cod ?? null,
    }));

    return {
      cards: {
        totalBudgeted,
        totalConverted,
        conversionRate,
        openCount,
        lostCount,
      },
      funnel,
      conversionReport,
      alerts: {
        expiringToday,
        expired,
        noResponse,
        noResponseDays: Number(noResponseDays),
      },
    };
  },
};
