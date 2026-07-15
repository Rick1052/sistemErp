import crypto from 'crypto';
import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import logger from '../../utils/logger.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.js';
import { parseDateInput } from '../../utils/date.js';
import { financialRecordService } from '../financial/financialRecord.service.js';
import { asaasClient } from './asaasClient.js';

const VALID_ENVIRONMENTS = ['SANDBOX', 'PRODUCTION'];

/** Formata uma data como YYYY-MM-DD (formato aceito pelo Asaas). */
function formatYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Próxima ocorrência de um dia do mês (1..28).
 * Se hoje <= dia no mês corrente, usa o mês corrente; caso contrário, o próximo mês.
 * Retorna um Date ao meio-dia UTC (evita "voltar um dia" por fuso).
 */
export function nextDueDateForDay(day, from = new Date()) {
  const d = Math.min(Math.max(Number(day) || 1, 1), 28);
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const today = from.getUTCDate();
  const targetMonth = today <= d ? month : month + 1;
  return new Date(Date.UTC(year, targetMonth, d, 12, 0, 0));
}

/** Retorna a API key em claro para o ambiente ativo da config. */
function apiKeyFor(config) {
  const enc = config.environment === 'PRODUCTION' ? config.apiKeyProducaoEnc : config.apiKeySandboxEnc;
  if (!enc) {
    throw new AppError(
      `Nenhuma API key configurada para o ambiente ${config.environment} do Asaas.`,
      400,
    );
  }
  return decryptSecret(enc);
}

/** Monta a URL pública do webhook a partir do token. */
function webhookUrl(token) {
  if (!token) return null;
  const base = (process.env.APP_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const path = `/api/asaas/webhook/${token}`;
  return base ? `${base}${path}` : path;
}

/** Versão segura da config para o frontend (nunca expõe a key em claro). */
function serializeConfig(config) {
  if (!config) return null;
  return {
    environment: config.environment,
    enabled: config.enabled,
    possuiChaveSandbox: Boolean(config.apiKeySandboxEnc),
    possuiChaveProducao: Boolean(config.apiKeyProducaoEnc),
    webhookUrl: webhookUrl(config.webhookToken),
  };
}

async function getConfigOrThrow(companyId) {
  const config = await prisma.asaasConfig.findUnique({ where: { companyId } });
  if (!config) throw new AppError('Integração com o Asaas ainda não foi configurada.', 400);
  if (!config.enabled) throw new AppError('Integração com o Asaas está desabilitada.', 400);
  return config;
}

export const asaasService = {
  async getConfig(companyId) {
    const config = await prisma.asaasConfig.findUnique({ where: { companyId } });
    return serializeConfig(config);
  },

  /** Salva/atualiza a API key (criptografada) e o ambiente. Gera webhookToken na primeira vez. */
  async configure(companyId, { environment, apiKey }) {
    if (!VALID_ENVIRONMENTS.includes(environment)) {
      throw new AppError('Ambiente inválido. Use SANDBOX ou PRODUCTION.', 400);
    }

    const keyField = environment === 'PRODUCTION' ? 'apiKeyProducaoEnc' : 'apiKeySandboxEnc';
    const encrypted = encryptSecret(apiKey);
    const webhookToken = crypto.randomUUID();

    const config = await prisma.asaasConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        environment,
        enabled: true,
        [keyField]: encrypted,
        webhookToken,
      },
      update: {
        environment,
        enabled: true,
        [keyField]: encrypted,
      },
    });

    return serializeConfig(config);
  },

  async setEnvironment(companyId, environment) {
    if (!VALID_ENVIRONMENTS.includes(environment)) {
      throw new AppError('Ambiente inválido. Use SANDBOX ou PRODUCTION.', 400);
    }
    const config = await prisma.asaasConfig.findUnique({ where: { companyId } });
    if (!config) throw new AppError('Integração com o Asaas ainda não foi configurada.', 400);

    const keyField = environment === 'PRODUCTION' ? 'apiKeyProducaoEnc' : 'apiKeySandboxEnc';
    if (!config[keyField]) {
      throw new AppError(`Nenhuma API key configurada para o ambiente ${environment}.`, 400);
    }

    const updated = await prisma.asaasConfig.update({
      where: { companyId },
      data: { environment },
    });
    return serializeConfig(updated);
  },

  /** Garante que o cliente exista no Asaas, salvando o cus_... em Client. */
  async ensureCustomer(config, client) {
    if (client.asaasCustomerId) return client.asaasCustomerId;

    const environment = config.environment;
    const apiKey = apiKeyFor(config);
    const document = (client.document || '').replace(/\D/g, '');
    if (!document) {
      throw new AppError('Cliente não possui CPF/CNPJ cadastrado, obrigatório para o Asaas.', 400);
    }

    const { status, data } = await asaasClient.createCustomer(environment, apiKey, {
      name: client.name,
      cpfCnpj: document,
      email: client.email || undefined,
      phone: client.phone || undefined,
      externalReference: client.id,
    });

    if (status >= 300 || !data?.id) {
      const msg = data?.errors?.[0]?.description || 'Erro ao criar cliente no Asaas';
      throw new AppError(msg, 400);
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { asaasCustomerId: data.id },
    });

    return data.id;
  },

  async createSubscription(companyId, payload) {
    const { clientId, value, dueDay, description, billingType } = payload;

    const config = await getConfigOrThrow(companyId);
    const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
    if (!client) throw new AppError('Cliente não encontrado', 404);

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      throw new AppError('Valor inválido para a assinatura', 400);
    }

    const customerId = await this.ensureCustomer(config, client);
    const nextDueDate = nextDueDateForDay(dueDay);
    const environment = config.environment;
    const apiKey = apiKeyFor(config);

    const { status, data } = await asaasClient.createSubscription(environment, apiKey, {
      customer: customerId,
      billingType: billingType || 'UNDEFINED',
      value: numericValue,
      nextDueDate: formatYmd(nextDueDate),
      cycle: 'MONTHLY',
      description,
    });

    if (status >= 300 || !data?.id) {
      const msg = data?.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas';
      logger.warn({ msg: '[asaasService] Erro ao criar assinatura', status, data });
      throw new AppError(msg, 400);
    }

    return prisma.asaasSubscription.create({
      data: {
        companyId,
        clientId,
        asaasSubscriptionId: data.id,
        asaasCustomerId: customerId,
        description,
        value: numericValue,
        cycle: 'MONTHLY',
        billingType: billingType || 'UNDEFINED',
        nextDueDate,
        status: 'ACTIVE',
      },
      include: { client: { select: { id: true, name: true, document: true } } },
    });
  },

  async listSubscriptions(companyId) {
    return prisma.asaasSubscription.findMany({
      where: { companyId },
      include: { client: { select: { id: true, name: true, document: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getSubscription(companyId, id) {
    const sub = await prisma.asaasSubscription.findFirst({
      where: { id, companyId },
      include: {
        client: { select: { id: true, name: true, document: true } },
        charges: { orderBy: { dueDate: 'desc' } },
      },
    });
    if (!sub) throw new AppError('Assinatura não encontrada', 404);
    return sub;
  },

  async cancelSubscription(companyId, id) {
    const config = await getConfigOrThrow(companyId);
    const sub = await prisma.asaasSubscription.findFirst({ where: { id, companyId } });
    if (!sub) throw new AppError('Assinatura não encontrada', 404);
    if (sub.status === 'CANCELLED') return sub;

    const { status, data } = await asaasClient.cancelSubscription(
      config.environment,
      apiKeyFor(config),
      sub.asaasSubscriptionId,
    );
    if (status >= 300 && status !== 404) {
      const msg = data?.errors?.[0]?.description || 'Erro ao cancelar assinatura no Asaas';
      throw new AppError(msg, 400);
    }

    return prisma.asaasSubscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED' },
    });
  },

  /**
   * Processa eventos de webhook do Asaas.
   * O token da URL identifica a empresa (AsaasConfig.webhookToken).
   * Idempotente: cada cobrança é espelhada em AsaasCharge (chave asaasPaymentId).
   */
  async handleWebhook(token, body) {
    if (!token) throw new AppError('Token de webhook ausente', 401);
    const config = await prisma.asaasConfig.findUnique({ where: { webhookToken: token } });
    if (!config) throw new AppError('Token de webhook inválido', 401);

    const event = body?.event;
    const payment = body?.payment;
    if (!event || !payment?.id || !payment?.subscription) {
      // Evento sem cobrança de assinatura — nada a fazer, mas responde 200.
      logger.info({ msg: '[asaasService] Webhook ignorado', event });
      return { ignored: true };
    }

    const subscription = await prisma.asaasSubscription.findUnique({
      where: { asaasSubscriptionId: payment.subscription },
    });
    if (!subscription || subscription.companyId !== config.companyId) {
      logger.warn({ msg: '[asaasService] Assinatura do webhook não encontrada', sub: payment.subscription });
      return { ignored: true };
    }

    const companyId = subscription.companyId;
    const dueDate = parseDateInput(payment.dueDate);
    const value = Number(payment.value);

    // Garante o espelho da cobrança (idempotente por asaasPaymentId)
    let charge = await prisma.asaasCharge.findUnique({
      where: { asaasPaymentId: payment.id },
    });
    if (!charge) {
      charge = await prisma.asaasCharge.create({
        data: {
          companyId,
          subscriptionId: subscription.id,
          clientId: subscription.clientId,
          asaasPaymentId: payment.id,
          value,
          dueDate,
          status: payment.status || event,
        },
      });
    }

    const isCreated = event === 'PAYMENT_CREATED';
    const isPaid = event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED';

    // Cria o título financeiro (RECEIVABLE/PENDING) quando a cobrança é gerada
    if (isCreated && !charge.financialRecordId) {
      const record = await financialRecordService.create(companyId, {
        type: 'RECEIVABLE',
        description: `${subscription.description} (Asaas ${payment.id})`,
        amount: value,
        date: new Date(),
        dueDate,
        status: 'PENDING',
        clientId: subscription.clientId,
      });
      charge = await prisma.asaasCharge.update({
        where: { id: charge.id },
        data: { status: payment.status || event, financialRecordId: record.id },
      });
    }

    // Quando confirmado/recebido, garante título e o marca como pago
    if (isPaid) {
      let financialRecordId = charge.financialRecordId;
      if (!financialRecordId) {
        const record = await financialRecordService.create(companyId, {
          type: 'RECEIVABLE',
          description: `${subscription.description} (Asaas ${payment.id})`,
          amount: value,
          date: new Date(),
          dueDate,
          status: 'PENDING',
          clientId: subscription.clientId,
        });
        financialRecordId = record.id;
      }

      const paymentDate = parseDateInput(payment.paymentDate || payment.clientPaymentDate) || new Date();
      await prisma.financialRecord.update({
        where: { id: financialRecordId },
        data: { status: 'PAID', paidAmount: value, paymentDate },
      });

      charge = await prisma.asaasCharge.update({
        where: { id: charge.id },
        data: { status: payment.status || event, financialRecordId },
      });
    }

    // Para os demais eventos, apenas reflete o status da cobrança
    if (!isCreated && !isPaid) {
      await prisma.asaasCharge.update({
        where: { id: charge.id },
        data: { status: payment.status || event },
      });
    }

    return { ok: true, chargeId: charge.id };
  },
};
