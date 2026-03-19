import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';

export const financialCategoryService = {
  async list(companyId) {
    return prisma.financialCategory.findMany({
      where: { companyId },
      orderBy: { cod: 'asc' },
      include: {
        parent: {
          select: { id: true, name: true }
        }
      }
    });
  },

  async getTree(companyId) {
    const categories = await prisma.financialCategory.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { cod: 'asc' },
    });

    const categoryMap = {};
    const tree = [];

    // Map all nodes first
    categories.forEach(cat => {
      categoryMap[cat.id] = { ...cat, children: [] };
    });

    // Link children to parents
    categories.forEach(cat => {
      if (cat.parentId && categoryMap[cat.parentId]) {
        categoryMap[cat.parentId].children.push(categoryMap[cat.id]);
      } else if (!cat.parentId) {
        tree.push(categoryMap[cat.id]);
      }
    });

    return tree;
  },

  async getById(companyId, id) {
    const category = await prisma.financialCategory.findFirst({
      where: { id, companyId },
      include: {
        parent: {
          select: { id: true, name: true }
        },
        children: {
          where: { status: 'ACTIVE' },
          orderBy: { cod: 'asc' }
        }
      }
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
