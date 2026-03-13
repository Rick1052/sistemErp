import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from "../../utils/createWithSequence.js";

export const saleStatusService = {
  async list(companyId) {
    return prisma.saleStatus.findMany({
      where: { companyId },
      orderBy: { cod: 'asc' },
    });
  },

  async getById(companyId, id) {
    const status = await prisma.saleStatus.findFirst({
      where: { id, companyId },
    });
    if (!status) throw new AppError('Status não encontrado', 404);
    return status;
  },

  async create(companyId, data) {
    return createWithSequence('saleStatus', companyId, data);
  },

  async update(companyId, id, data) {
    await this.getById(companyId, id);

    return prisma.saleStatus.update({
      where: { id },
      data,
    });
  },

  async delete(companyId, id) {
    await this.getById(companyId, id);

    // Check if status is in use
    const inUse = await prisma.sale.findFirst({
      where: { statusId: id },
    });
    if (inUse) throw new AppError('Não é possível excluir um status que está sendo utilizado em vendas.', 400);

    return prisma.saleStatus.delete({
      where: { id },
    });
  },

  async seedDefaults(companyId) {
    const defaults = [
      { name: 'Orçamento', color: '#808080', stockAction: 'NONE' },
      { name: 'Aguardando Pagamento', color: '#FFA500', stockAction: 'RESERVE' },
      { name: 'Faturado', color: '#008000', stockAction: 'COMMIT' },
      { name: 'Cancelado', color: '#FF0000', stockAction: 'NONE' },
    ];

    for (const item of defaults) {
      const exists = await prisma.saleStatus.findFirst({
        where: { companyId, name: item.name }
      });
      if (!exists) {
        await this.create(companyId, item);
      }
    }
  }
};
