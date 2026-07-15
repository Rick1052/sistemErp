import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import logger from '../../utils/logger.js';
import { asaasClient } from './asaasClient.js';

/** Credenciais da conta Asaas da plataforma (via env). */
function getPlatformCreds() {
  const environment = (process.env.ASAAS_ENVIRONMENT || 'SANDBOX').toUpperCase();
  const apiKey = process.env.ASAAS_API_KEY || '';
  return { environment, apiKey };
}

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

function webhookUrl() {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!token) return null;
  const base = (process.env.APP_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const path = `/api/platform/billing/webhook/${token}`;
  return base ? `${base}${path}` : path;
}

function requireCreds() {
  const creds = getPlatformCreds();
  if (!creds.apiKey) {
    throw new AppError('ASAAS_API_KEY não configurada no servidor da plataforma.', 500);
  }
  if (!['SANDBOX', 'PRODUCTION'].includes(creds.environment)) {
    throw new AppError('ASAAS_ENVIRONMENT inválido (use SANDBOX ou PRODUCTION).', 500);
  }
  return creds;
}

export const platformBillingService = {
  getStatus() {
    const { environment, apiKey } = getPlatformCreds();
    return {
      configured: Boolean(apiKey),
      environment,
      webhookConfigured: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
      webhookUrl: webhookUrl(),
    };
  },

  /** Empresas + status da assinatura da mensalidade e da última cobrança. */
  async listCompanies() {
    const companies = await prisma.company.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        legalName: true,
        document: true,
        platformSubscription: {
          include: {
            charges: { orderBy: { dueDate: 'desc' }, take: 1 },
          },
        },
      },
    });

    return companies.map((c) => {
      const sub = c.platformSubscription;
      const lastCharge = sub?.charges?.[0] || null;
      return {
        id: c.id,
        name: c.name,
        legalName: c.legalName,
        document: c.document,
        subscription: sub
          ? {
              id: sub.id,
              asaasSubscriptionId: sub.asaasSubscriptionId,
              value: sub.value,
              billingType: sub.billingType,
              nextDueDate: sub.nextDueDate,
              status: sub.status,
              description: sub.description,
            }
          : null,
        lastCharge: lastCharge
          ? {
              value: lastCharge.value,
              dueDate: lastCharge.dueDate,
              status: lastCharge.status,
              paidAt: lastCharge.paidAt,
            }
          : null,
      };
    });
  },

  async listSubscriptions() {
    return prisma.platformSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true, document: true } },
        charges: { orderBy: { dueDate: 'desc' }, take: 1 },
      },
    });
  },

  /** Garante o customer da empresa (tenant) na conta Asaas da plataforma. */
  async ensureCustomer(creds, company, cpfCnpjOverride) {
    if (company.asaasCustomerId) return company.asaasCustomerId;

    const document = String(cpfCnpjOverride || company.document || '').replace(/\D/g, '');
    if (!document) {
      throw new AppError('A empresa não tem CNPJ/CPF cadastrado. Informe o documento para criar a cobrança.', 400);
    }

    const { status, data } = await asaasClient.createCustomer(creds.environment, creds.apiKey, {
      name: company.legalName || company.name,
      cpfCnpj: document,
      email: company.email || undefined,
      phone: company.phone || undefined,
      externalReference: company.id,
    });

    if (status >= 300 || !data?.id) {
      const msg = data?.errors?.[0]?.description || 'Erro ao criar cliente no Asaas';
      throw new AppError(msg, 400);
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { asaasCustomerId: data.id },
    });

    return data.id;
  },

  async createSubscription({ companyId, cpfCnpj, value, dueDay, description, billingType }) {
    const creds = requireCreds();

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { platformSubscription: true },
    });
    if (!company) throw new AppError('Empresa não encontrada', 404);
    if (company.platformSubscription && company.platformSubscription.status !== 'CANCELLED') {
      throw new AppError('Esta empresa já possui uma assinatura ativa.', 400);
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      throw new AppError('Valor inválido para a assinatura', 400);
    }

    const customerId = await this.ensureCustomer(creds, company, cpfCnpj);
    const nextDueDate = nextDueDateForDay(dueDay);

    const { status, data } = await asaasClient.createSubscription(creds.environment, creds.apiKey, {
      customer: customerId,
      billingType: billingType || 'UNDEFINED',
      value: numericValue,
      nextDueDate: formatYmd(nextDueDate),
      cycle: 'MONTHLY',
      description,
      externalReference: company.id,
    });

    if (status >= 300 || !data?.id) {
      const msg = data?.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas';
      logger.warn({ msg: '[platformBilling] Erro ao criar assinatura', status, data });
      throw new AppError(msg, 400);
    }

    // Se havia uma assinatura CANCELLED, substitui pelo registro novo
    if (company.platformSubscription) {
      await prisma.platformSubscription.delete({ where: { id: company.platformSubscription.id } });
    }

    return prisma.platformSubscription.create({
      data: {
        companyId,
        asaasCustomerId: customerId,
        asaasSubscriptionId: data.id,
        description,
        value: numericValue,
        cycle: 'MONTHLY',
        billingType: billingType || 'UNDEFINED',
        nextDueDate,
        status: 'ACTIVE',
      },
      include: { company: { select: { id: true, name: true, document: true } } },
    });
  },

  async cancelSubscription(id) {
    const creds = requireCreds();
    const sub = await prisma.platformSubscription.findUnique({ where: { id } });
    if (!sub) throw new AppError('Assinatura não encontrada', 404);
    if (sub.status === 'CANCELLED') return sub;

    const { status, data } = await asaasClient.cancelSubscription(
      creds.environment,
      creds.apiKey,
      sub.asaasSubscriptionId,
    );
    if (status >= 300 && status !== 404) {
      const msg = data?.errors?.[0]?.description || 'Erro ao cancelar assinatura no Asaas';
      throw new AppError(msg, 400);
    }

    return prisma.platformSubscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED' },
    });
  },

  /**
   * Faturas da mensalidade vistas pelo próprio tenant (ADMIN da empresa).
   * Retorna a assinatura da empresa + últimas cobranças, com link de pagamento.
   */
  async getMyBilling(companyId) {
    const subscription = await prisma.platformSubscription.findUnique({
      where: { companyId },
    });
    if (!subscription) return { subscription: null, charges: [], hasOverdue: false };

    let charges = await prisma.platformCharge.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { dueDate: 'desc' },
      take: 12,
    });

    // Backfill do link de pagamento para cobranças em aberto que ainda não têm URL
    const missing = charges.filter((c) => !c.invoiceUrl && !c.paidAt);
    if (missing.length > 0 && process.env.ASAAS_API_KEY) {
      const creds = getPlatformCreds();
      for (const c of missing) {
        try {
          const { status, data } = await asaasClient.getPayment(creds.environment, creds.apiKey, c.asaasPaymentId);
          if (status < 300 && data?.invoiceUrl) {
            await prisma.platformCharge.update({
              where: { id: c.id },
              data: { invoiceUrl: data.invoiceUrl },
            });
          }
        } catch (error) {
          logger.warn({ msg: '[platformBilling] Falha no backfill de invoiceUrl', chargeId: c.id, error: error.message });
        }
      }
      charges = await prisma.platformCharge.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { dueDate: 'desc' },
        take: 12,
      });
    }

    const now = new Date();
    const isCancelledLike = (s) => ['REFUNDED', 'DELETED', 'CANCELLED'].includes(String(s).toUpperCase());
    const hasOverdue = charges.some((c) => !c.paidAt && !isCancelledLike(c.status) && new Date(c.dueDate) < now);

    return {
      subscription: {
        description: subscription.description,
        value: subscription.value,
        billingType: subscription.billingType,
        nextDueDate: subscription.nextDueDate,
        status: subscription.status,
      },
      charges: charges.map((c) => ({
        id: c.id,
        value: c.value,
        dueDate: c.dueDate,
        status: c.status,
        paidAt: c.paidAt,
        invoiceUrl: c.invoiceUrl,
      })),
      hasOverdue,
    };
  },

  /**
   * Webhook do Asaas (conta da plataforma). Valida o token da URL contra ASAAS_WEBHOOK_TOKEN.
   * Idempotente: cada cobrança vira um PlatformCharge (chave asaasPaymentId).
   */
  async handleWebhook(token, body) {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!expected || token !== expected) {
      throw new AppError('Token de webhook inválido', 401);
    }

    const event = body?.event;
    const payment = body?.payment;
    if (!event || !payment?.id || !payment?.subscription) {
      logger.info({ msg: '[platformBilling] Webhook ignorado', event });
      return { ignored: true };
    }

    const subscription = await prisma.platformSubscription.findUnique({
      where: { asaasSubscriptionId: payment.subscription },
    });
    if (!subscription) {
      logger.warn({ msg: '[platformBilling] Assinatura do webhook não encontrada', sub: payment.subscription });
      return { ignored: true };
    }

    const isPaid = event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED';
    const paidAt = isPaid
      ? (payment.paymentDate ? new Date(`${payment.paymentDate}T12:00:00Z`) : new Date())
      : null;
    const dueDate = payment.dueDate ? new Date(`${payment.dueDate}T12:00:00Z`) : new Date();
    const value = Number(payment.value);

    const charge = await prisma.platformCharge.upsert({
      where: { asaasPaymentId: payment.id },
      create: {
        companyId: subscription.companyId,
        subscriptionId: subscription.id,
        asaasPaymentId: payment.id,
        value,
        dueDate,
        status: payment.status || event,
        paidAt,
        invoiceUrl: payment.invoiceUrl || null,
      },
      update: {
        status: payment.status || event,
        ...(isPaid ? { paidAt } : {}),
        ...(payment.invoiceUrl ? { invoiceUrl: payment.invoiceUrl } : {}),
      },
    });

    return { ok: true, chargeId: charge.id };
  },
};
