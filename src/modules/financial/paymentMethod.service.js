import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';

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
    return createWithSequence('paymentMethod', companyId, data);
  },

  async update(companyId, id, data) {
    await this.getById(companyId, id);
    return prisma.paymentMethod.update({
      where: { id },
      data,
    });
  },

  async delete(companyId, id) {
    await this.getById(companyId, id);
    return prisma.paymentMethod.delete({
      where: { id },
    });
  }
};
