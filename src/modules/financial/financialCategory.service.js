import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';
import { assertCostCenterBelongsToCompany } from '../costCenters/costCenter.service.js';

const ALLOWED_FIELDS = new Set([
  'name',
  'type',
  'status',
  'parentId',
  'isSelectable',
  'hierarchyCode',
  'defaultCostCenterId',
]);

function sanitizeCategoryData(data = {}) {
  const payload = Object.fromEntries(
    Object.entries(data).filter(([key]) => ALLOWED_FIELDS.has(key)),
  );
  if (payload.parentId === 'none' || payload.parentId === '') payload.parentId = null;
  if (payload.defaultCostCenterId === 'none' || payload.defaultCostCenterId === '') {
    payload.defaultCostCenterId = null;
  }
  return payload;
}

async function assertParentBelongsToCompany(companyId, parentId, currentId = null) {
  if (!parentId) return;
  if (parentId === currentId) throw new AppError('Uma conta não pode ser vinculada a ela mesma', 400);
  const parent = await prisma.financialCategory.findFirst({
    where: { id: parentId, companyId },
    select: { id: true },
  });
  if (!parent) throw new AppError('Conta superior não pertence à empresa atual', 400);
}

export const financialCategoryService = {
  async list(companyId) {
    return prisma.financialCategory.findMany({
      where: { companyId },
      orderBy: { cod: 'asc' },
      include: {
        parent: {
          select: { id: true, name: true }
        },
        defaultCostCenter: {
          select: { id: true, cod: true, name: true, status: true },
        },
      }
    });
  },

  async getTree(companyId) {
    const categories = await prisma.financialCategory.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { cod: 'asc' },
      include: {
        defaultCostCenter: {
          select: { id: true, cod: true, name: true, status: true },
        },
      },
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
        },
        defaultCostCenter: {
          select: { id: true, cod: true, name: true, status: true },
        },
      }
    });
    if (!category) throw new AppError('Categoria financeira não encontrada', 404);
    return category;
  },

  async create(companyId, data) {
    const payload = sanitizeCategoryData(data);
    await Promise.all([
      assertParentBelongsToCompany(companyId, payload.parentId),
      assertCostCenterBelongsToCompany(prisma, companyId, payload.defaultCostCenterId, {
        requireActive: Boolean(payload.defaultCostCenterId),
      }),
    ]);
    return createWithSequence('financialCategory', companyId, payload);
  },

  async update(companyId, id, data) {
    const existing = await this.getById(companyId, id);
    const payload = sanitizeCategoryData(data);
    const defaultChanged = payload.defaultCostCenterId !== undefined
      && payload.defaultCostCenterId !== existing.defaultCostCenterId;
    await Promise.all([
      payload.parentId !== undefined
        ? assertParentBelongsToCompany(companyId, payload.parentId, id)
        : Promise.resolve(),
      defaultChanged
        ? assertCostCenterBelongsToCompany(prisma, companyId, payload.defaultCostCenterId, {
            requireActive: Boolean(payload.defaultCostCenterId),
          })
        : Promise.resolve(),
    ]);
    return prisma.financialCategory.update({
      where: { id },
      data: payload,
    });
  },

  async delete(companyId, id) {
    await this.getById(companyId, id);
    return prisma.financialCategory.delete({
      where: { id },
    });
  }
};
