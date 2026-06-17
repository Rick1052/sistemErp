import { budgetService } from './budget.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseDateInput } from '../../utils/date.js';
import { AppError } from '../../utils/AppError.js';

function assertCanApprove(role) {
  if (role !== 'ADMIN') {
    throw new AppError('Apenas administradores podem aprovar orçamentos', 403);
  }
}

function assertCanDelete(role) {
  if (role !== 'ADMIN') {
    throw new AppError('Apenas administradores podem excluir orçamentos', 403);
  }
}

export const budgetController = {
  list: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { page, limit, startDate, endDate, search, status, clientId, sellerId, cod } = req.query;
    const result = await budgetService.list(companyId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 25,
      startDate,
      endDate,
      search,
      status,
      clientId,
      sellerId,
      cod,
    });
    return res.json(result);
  }),

  getDashboard: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { noResponseDays } = req.query;
    const result = await budgetService.getDashboard(companyId, {
      noResponseDays: parseInt(noResponseDays) || 7,
    });
    return res.json(result);
  }),

  getById: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const budget = await budgetService.getById(companyId, req.params.id);
    return res.json(budget);
  }),

  create: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const body = req.validatedBody ?? req.body;
    const budget = await budgetService.create(companyId, userId, body);
    return res.status(201).json(budget);
  }),

  update: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const body = req.validatedBody ?? req.body;
    const budget = await budgetService.update(companyId, userId, req.params.id, body);
    return res.json(budget);
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const { companyId, userRole } = req;
    const { id: userId } = req.user;
    const { status, ...rest } = req.body;

    if (status === 'APPROVED') {
      assertCanApprove(userRole);
    }

    const budget = await budgetService.updateStatus(companyId, userId, req.params.id, {
      status,
      ...rest,
    });
    return res.json(budget);
  }),

  delete: asyncHandler(async (req, res) => {
    const { companyId, userRole } = req;
    assertCanDelete(userRole);
    const result = await budgetService.delete(companyId, req.params.id);
    return res.json(result);
  }),

  convertToSale: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const budget = await budgetService.convertToSale(companyId, userId, req.params.id);
    return res.json(budget);
  }),
};
