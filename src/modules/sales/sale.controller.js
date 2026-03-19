import { saleService } from './sale.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const saleController = {
  list: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { page, limit, startDate, endDate } = req.query;
    
    const parsedPage = parseInt(page) || 1;
    const parsedLimit = parseInt(limit) || 10;

    const result = await saleService.list(companyId, {
      page: parsedPage > 0 ? parsedPage : 1,
      limit: parsedLimit > 0 ? parsedLimit : 10,
      startDate,
      endDate
    });
    return res.json(result);
  }),

  getById: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id } = req.params;
    const sale = await saleService.getById(companyId, id);
    return res.json(sale);
  }),

  create: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { date, ...rest } = req.body;

    const formattedData = {
      ...rest,
      date: date ? new Date(date) : new Date()
    };

    // Validar se a data é válida
    if (isNaN(formattedData.date.getTime())) {
      formattedData.date = new Date();
    }

    const sale = await saleService.create(companyId, userId, formattedData);
    return res.status(201).json(sale);
  }),

  update: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const { date, ...rest } = req.body;

    const formattedData = {
      ...rest,
      date: date ? new Date(date) : new Date()
    };

    // Validar se a data é válida
    if (isNaN(formattedData.date.getTime())) {
      formattedData.date = new Date();
    }

    const sale = await saleService.update(companyId, userId, id, formattedData);
    return res.json(sale);
  }),

  delete: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const result = await saleService.delete(companyId, userId, id);
    return res.json(result);
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const { statusId, installments } = req.body;
    const sale = await saleService.updateStatus(companyId, userId, id, statusId, installments);
    return res.json(sale);
  })
};
