import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';

async function assertDestinationConsistency(companyId, valueDestination, destinationAccountId) {
  const dest = valueDestination || 'RECEIVABLE_ONLY';
  if (dest === 'BANK_ACCOUNT') {
    if (!destinationAccountId) {
      throw new AppError('Para destino "Conta bancária", selecione qual conta receberá o valor.', 400);
    }
    const acc = await prisma.bankAccount.findFirst({
      where: { id: destinationAccountId, companyId },
    });
    if (!acc) throw new AppError('Conta bancária não encontrada nesta empresa.', 400);
  }
}

function normalizePaymentMethodPayload(data) {
  const out = { ...data };
  if (out.destinationAccountId === '') out.destinationAccountId = null;
  const dest = out.valueDestination || 'RECEIVABLE_ONLY';
  if (dest === 'RECEIVABLE_ONLY') {
    out.destinationAccountId = null;
  }
  return out;
}

export const paymentMethodService = {
  async list(companyId) {
    return prisma.paymentMethod.findMany({
      where: { companyId },
      include: { destinationAccount: true },
      orderBy: { cod: 'asc' },
    });
  },

  async getById(companyId, id) {
    const method = await prisma.paymentMethod.findFirst({
      where: { id, companyId },
      include: { destinationAccount: true },
    });
    if (!method) throw new AppError('Forma de pagamento não encontrada', 404);
    return method;
  },

  async create(companyId, data) {
    const raw = {
      name: data.name,
      feePercentage: data.feePercentage ?? 0,
      isImmediate: data.isImmediate !== undefined ? data.isImmediate : true,
      installments: data.installments ?? 1,
      installmentInterval: data.installmentInterval ?? 30,
      valueDestination: data.valueDestination || 'RECEIVABLE_ONLY',
      destinationAccountId: data.destinationAccountId,
      status: data.status || 'ACTIVE',
    };
    const payload = normalizePaymentMethodPayload(raw);
    await assertDestinationConsistency(companyId, payload.valueDestination, payload.destinationAccountId);

    try {
      return await createWithSequence('paymentMethod', companyId, payload);
    } catch (err) {
      throw err;
    }
  },

  async update(companyId, id, data) {
    const existing = await this.getById(companyId, id);
    const merged = {
      name: data.name ?? existing.name,
      feePercentage: data.feePercentage !== undefined ? data.feePercentage : existing.feePercentage,
      isImmediate: data.isImmediate !== undefined ? data.isImmediate : existing.isImmediate,
      installments: data.installments !== undefined ? data.installments : existing.installments,
      installmentInterval: data.installmentInterval !== undefined ? data.installmentInterval : existing.installmentInterval,
      valueDestination: data.valueDestination ?? existing.valueDestination,
      destinationAccountId: data.destinationAccountId !== undefined ? data.destinationAccountId : existing.destinationAccountId,
      status: data.status ?? existing.status,
    };
    const payload = normalizePaymentMethodPayload(merged);
    await assertDestinationConsistency(companyId, payload.valueDestination, payload.destinationAccountId);
    return prisma.paymentMethod.update({
      where: { id },
      data: payload,
    });
  },

  async delete(companyId, id) {
    await this.getById(companyId, id);
    return prisma.paymentMethod.delete({
      where: { id },
    });
  }
};
