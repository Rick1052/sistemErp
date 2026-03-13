import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';

export const financialCategoryService = {
  async list(companyId) {
    return prisma.financialCategory.findMany({
      where: { companyId },
      orderBy: { cod: 'asc' },
    });
  },

  async getById(companyId, id) {
    const category = await prisma.financialCategory.findFirst({
      where: { id, companyId },
    });
    if (!category) throw new AppError('Categoria financeira não encontrada', 404);
    return category;
  },

  async create(companyId, data) {
    return createWithSequence('financialCategory', companyId, data);
  },

  async update(companyId, id, data) {
    await this.getById(companyId, id);
    return prisma.financialCategory.update({
      where: { id },
      data,
    });
  },

  async delete(companyId, id) {
    await this.getById(companyId, id);
    return prisma.financialCategory.delete({
      where: { id },
    });
  }
};
