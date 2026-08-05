import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { reserveSequenceRange } from '../../utils/createWithSequence.js';
import { parseDateInput } from '../../utils/date.js';
import logger from '../../utils/logger.js';

/**
 * Crédito em conta do cliente (saldo em haver).
 *
 * A fonte da verdade é o razão `ClientCredit`: cada linha guarda o delta com sinal
 * (`amount`), o saldo antes e o saldo depois. `Client.creditBalance` é apenas o
 * espelho, atualizado no mesmo UPDATE atômico que valida "saldo nunca negativo".
 *
 * Toda função de escrita aceita uma transação externa (`tx`) para que a geração /
 * utilização de crédito aconteça junto com a baixa ou com o pedido: se qualquer
 * etapa falhar, nada é gravado.
 */

/** Meio centavo: tolerância para comparações de valores monetários */
const EPSILON = 0.005;

/** Arredonda para 2 casas evitando o clássico 0.1 + 0.2 do ponto flutuante */
export const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const formatBRL = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const runInTransaction = (txExternal, execute) =>
  txExternal ? execute(txExternal) : prisma.$transaction(execute, { timeout: 30000 });

/**
 * Aplica um delta no saldo do cliente e grava a movimentação correspondente.
 *
 * O UPDATE é condicional (`creditBalance + delta >= 0`): duas transações
 * concorrentes tentando gastar o mesmo saldo não conseguem furar o limite, porque
 * a segunda não encontra linha para atualizar. É isso que garante a Regra 11
 * ("não permitir gerar saldo negativo") mesmo sob concorrência.
 */
async function applyMovement(tx, {
  companyId,
  clientId,
  delta,
  type,
  saleId = null,
  financialRecordId = null,
  financialRecordPaymentId = null,
  userId = null,
  note = null,
}) {
  const amount = round2(delta);

  if (!clientId) throw new AppError('Cliente é obrigatório para movimentar crédito', 400);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new AppError('Valor da movimentação de crédito inválido', 400);
  }

  const deltaText = amount.toFixed(2);
  const rows = await tx.$queryRaw`
    UPDATE "Client"
       SET "creditBalance" = "creditBalance" + ${deltaText}::numeric,
           "updatedAt" = NOW()
     WHERE "id" = ${clientId}
       AND "companyId" = ${companyId}
       AND "creditBalance" + ${deltaText}::numeric >= 0
    RETURNING "creditBalance"`;

  if (rows.length === 0) {
    // Ou o cliente não existe/não é desta empresa, ou o saldo não cobre a operação.
    const client = await tx.client.findFirst({
      where: { id: clientId, companyId },
      select: { creditBalance: true },
    });
    if (!client) throw new AppError('Cliente não encontrado', 404);
    throw new AppError(
      `Saldo de crédito insuficiente. Disponível: ${formatBRL(client.creditBalance)}, solicitado: ${formatBRL(Math.abs(amount))}.`,
      400,
    );
  }

  const newBalance = round2(rows[0].creditBalance);
  const previousBalance = round2(newBalance - amount);

  const cod = await reserveSequenceRange('clientCredit', companyId, 1, tx);

  return tx.clientCredit.create({
    data: {
      cod,
      companyId,
      clientId,
      saleId,
      financialRecordId,
      financialRecordPaymentId,
      type,
      amount,
      previousBalance,
      newBalance,
      note,
      userId,
    },
  });
}

/** Garante que o pedido informado existe, é da empresa e é do mesmo cliente (Regra 11) */
async function assertSaleBelongsToClient(tx, companyId, saleId, clientId) {
  if (!saleId) return;
  const sale = await tx.sale.findFirst({
    where: { id: saleId, companyId },
    select: { clientId: true },
  });
  if (!sale) throw new AppError('Pedido não encontrado', 404);
  if (sale.clientId !== clientId) {
    throw new AppError('O crédito de um cliente não pode ser usado no pedido de outro cliente.', 400);
  }
}

export const clientCreditService = {
  /**
   * Regra 1 — cria crédito em conta para o cliente (ex.: recebimento acima do título).
   * `amount` é sempre positivo.
   */
  async gerarCredito({
    companyId,
    clientId,
    amount,
    saleId = null,
    financialRecordId = null,
    financialRecordPaymentId = null,
    userId = null,
    note = null,
  }, txExternal = null) {
    const value = round2(amount);
    if (!Number.isFinite(value) || value <= EPSILON) {
      throw new AppError('O valor do crédito deve ser maior que zero', 400);
    }

    return runInTransaction(txExternal, async (tx) => {
      const movement = await applyMovement(tx, {
        companyId,
        clientId,
        delta: value,
        type: 'CREDIT',
        saleId,
        financialRecordId,
        financialRecordPaymentId,
        userId,
        note,
      });

      logger.info(
        `[clientCreditService.gerarCredito] Cliente=${clientId} +${value} → saldo ${movement.newBalance}`,
      );
      return movement;
    });
  },

  /**
   * Regras 4 e 5 — consome (parte do) crédito do cliente. `amount` é sempre positivo;
   * o razão grava o delta negativo. Falha se o saldo não cobrir o valor pedido.
   */
  async utilizarCredito({
    companyId,
    clientId,
    amount,
    saleId = null,
    financialRecordId = null,
    userId = null,
    note = null,
  }, txExternal = null) {
    const value = round2(amount);
    if (!Number.isFinite(value) || value <= EPSILON) {
      throw new AppError('O valor a utilizar deve ser maior que zero', 400);
    }

    return runInTransaction(txExternal, async (tx) => {
      await assertSaleBelongsToClient(tx, companyId, saleId, clientId);

      const movement = await applyMovement(tx, {
        companyId,
        clientId,
        delta: -value,
        type: 'USAGE',
        saleId,
        financialRecordId,
        userId,
        note,
      });

      logger.info(
        `[clientCreditService.utilizarCredito] Cliente=${clientId} -${value} → saldo ${movement.newBalance}`,
      );
      return movement;
    });
  },

  /**
   * Ajuste manual / estorno. Aqui `amount` vem COM SINAL: positivo credita,
   * negativo debita. Exige observação — ajuste sem motivo registrado não é rastreável.
   */
  async ajustarCredito({
    companyId,
    clientId,
    amount,
    saleId = null,
    financialRecordId = null,
    financialRecordPaymentId = null,
    userId = null,
    note,
  }, txExternal = null) {
    const value = round2(amount);
    if (!Number.isFinite(value) || Math.abs(value) <= EPSILON) {
      throw new AppError('O valor do ajuste deve ser diferente de zero', 400);
    }
    if (!note || !String(note).trim()) {
      throw new AppError('Informe o motivo do ajuste de crédito', 400);
    }

    return runInTransaction(txExternal, async (tx) => {
      await assertSaleBelongsToClient(tx, companyId, saleId, clientId);

      const movement = await applyMovement(tx, {
        companyId,
        clientId,
        delta: value,
        type: 'ADJUSTMENT',
        saleId,
        financialRecordId,
        financialRecordPaymentId,
        userId,
        note: String(note).trim(),
      });

      logger.info(
        `[clientCreditService.ajustarCredito] Cliente=${clientId} ${value > 0 ? '+' : ''}${value} → saldo ${movement.newBalance}`,
      );
      return movement;
    });
  },

  /** Regra 2 — saldo disponível do cliente, para exibir em qualquer tela */
  async consultarSaldoCliente(companyId, clientId, txExternal = null) {
    const db = txExternal || prisma;
    const client = await db.client.findFirst({
      where: { id: clientId, companyId },
      select: { id: true, name: true, document: true, creditBalance: true },
    });
    if (!client) throw new AppError('Cliente não encontrado', 404);

    return {
      clientId: client.id,
      clientName: client.name,
      document: client.document,
      balance: round2(client.creditBalance),
    };
  },

  /** Saldo de vários clientes de uma vez (listagens) — evita N chamadas */
  async consultarSaldos(companyId, clientIds = []) {
    const ids = [...new Set(clientIds.filter(Boolean))];
    if (ids.length === 0) return {};

    const clients = await prisma.client.findMany({
      where: { companyId, id: { in: ids } },
      select: { id: true, creditBalance: true },
    });

    return Object.fromEntries(clients.map((c) => [c.id, round2(c.creditBalance)]));
  },

  /** Regra 6 — histórico de movimentações com filtros e paginação */
  async listarHistoricoCredito(companyId, filters = {}) {
    const { clientId, saleId, type, startDate, endDate } = filters;
    const page = Math.max(1, Number(filters.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit ?? 25) || 25));
    const skip = (page - 1) * limit;

    const where = { companyId };
    if (clientId) where.clientId = clientId;
    if (saleId) where.saleId = saleId;
    if (type) where.type = type;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const d = parseDateInput(startDate);
        d.setUTCHours(0, 0, 0, 0);
        where.createdAt.gte = d;
      }
      if (endDate) {
        const d = parseDateInput(endDate);
        d.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    const [total, data, balance] = await Promise.all([
      prisma.clientCredit.count({ where }),
      prisma.clientCredit.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, document: true } },
          sale: { select: { id: true, cod: true } },
          financialRecord: { select: { id: true, cod: true, description: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      clientId
        ? prisma.client
            .findFirst({ where: { id: clientId, companyId }, select: { creditBalance: true } })
            .then((c) => (c ? round2(c.creditBalance) : 0))
        : Promise.resolve(null),
    ]);

    return { data, total, page, limit, balance };
  },

  /**
   * Devolve ao cliente um crédito que havia sido consumido (pedido excluído/cancelado)
   * ou retira um crédito que havia sido gerado (baixa estornada).
   *
   * É gravado como AJUSTE porque não é uma nova concessão nem um novo consumo —
   * é a correção de uma movimentação anterior, e o motivo fica no histórico.
   */
  async estornarMovimentacao({
    companyId,
    clientId,
    amount,
    saleId = null,
    financialRecordId = null,
    financialRecordPaymentId = null,
    userId = null,
    note,
  }, txExternal = null) {
    return this.ajustarCredito(
      { companyId, clientId, amount, saleId, financialRecordId, financialRecordPaymentId, userId, note },
      txExternal,
    );
  },
};
