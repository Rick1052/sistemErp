import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';
import { normalizeCostCenterName } from '../../utils/normalizeCostCenterName.js';

function normalizePayload(data) {
  const payload = {};

  if (data.name !== undefined) {
    const name = String(data.name).trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeCostCenterName(name);
    if (!normalizedName) throw new AppError('Nome do centro de custo é obrigatório', 400);
    payload.name = name;
    payload.normalizedName = normalizedName;
  }

  if (data.description !== undefined) {
    const description = data.description == null ? '' : String(data.description).trim();
    payload.description = description || null;
  }

  if (data.status !== undefined) payload.status = data.status;
  return payload;
}

function mapUniqueError(error) {
  if (error?.code === 'P2002') {
    throw new AppError('Já existe um centro de custo com este nome nesta empresa', 409);
  }
  throw error;
}

export async function assertCostCenterBelongsToCompany(
  client,
  companyId,
  costCenterId,
  { requireActive = false } = {},
) {
  if (!costCenterId) return null;

  const costCenter = await client.costCenter.findFirst({
    where: { id: costCenterId, companyId },
  });

  if (!costCenter) {
    throw new AppError('Centro de custo não encontrado nesta empresa', 400);
  }
  if (requireActive && costCenter.status !== 'ACTIVE') {
    throw new AppError('Centro de custo inativo não pode ser usado em novos lançamentos', 400);
  }

  return costCenter;
}

/**
 * Escopos aceitos em relatórios:
 * - all/ausente: consolidado, incluindo não classificados
 * - assigned: somente registros classificados
 * - unassigned: somente registros sem centro
 * - UUID/ID: um centro específico, sempre validado contra a empresa atual
 */
export async function resolveCostCenterScope(client, companyId, rawScope) {
  const scope = rawScope == null || rawScope === '' ? 'all' : String(rawScope);
  if (scope === 'all') return {};
  if (scope === 'assigned') return { costCenterId: { not: null } };
  if (scope === 'unassigned') return { costCenterId: null };

  await assertCostCenterBelongsToCompany(client, companyId, scope);
  return { costCenterId: scope };
}

export function buildCostCenterService(client = prisma, sequenceCreator = createWithSequence) {
  const service = {
    async list(companyId, filters = {}) {
      const where = { companyId };
      const status = filters.status ? String(filters.status).toUpperCase() : null;
      if (status && !['ACTIVE', 'INACTIVE', 'ALL'].includes(status)) {
        throw new AppError('Status de centro de custo inválido', 400);
      }
      if (status && status !== 'ALL') where.status = status;

      const search = String(filters.search ?? '').trim();
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      return client.costCenter.findMany({
        where,
        include: {
          _count: { select: { sales: true, budgets: true, financialRecords: true } },
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      });
    },

    async getById(companyId, id) {
      const costCenter = await client.costCenter.findFirst({
        where: { id, companyId },
        include: {
          _count: { select: { sales: true, budgets: true, financialRecords: true } },
        },
      });
      if (!costCenter) throw new AppError('Centro de custo não encontrado', 404);
      return costCenter;
    },

    async create(companyId, data) {
      const payload = normalizePayload(data);
      if (!payload.name) throw new AppError('Nome do centro de custo é obrigatório', 400);

      try {
        return await sequenceCreator('costCenter', companyId, {
          ...payload,
          status: payload.status || 'ACTIVE',
        });
      } catch (error) {
        mapUniqueError(error);
      }
    },

    async update(companyId, id, data) {
      await this.getById(companyId, id);
      const payload = normalizePayload(data);
      if (Object.keys(payload).length === 0) {
        throw new AppError('Nenhuma alteração informada', 400);
      }

      try {
        return await client.costCenter.update({ where: { id }, data: payload });
      } catch (error) {
        mapUniqueError(error);
      }
    },

    async updateStatus(companyId, id, status) {
      await this.getById(companyId, id);
      return client.costCenter.update({ where: { id }, data: { status } });
    },
  };
  return service;
}

export const costCenterService = buildCostCenterService();
