import { saleService } from './sale.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseDateInput } from '../../utils/date.js';
import { cacheGetOrSetJSONWithStatus, cacheKeyFromReq } from '../../utils/cache.js';
import { cacheBumpVersion } from '../../utils/cache.js';

export const saleController = {
  list: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { page, limit, startDate, endDate } = req.query;
    
    const parsedPage = parseInt(page) || 1;
    const parsedLimit = parseInt(limit) || 25;

    const key = await cacheKeyFromReq({
      companyId,
      resource: 'sales',
      query: req.query,
    });

    const { value: result, status } = await cacheGetOrSetJSONWithStatus({
      key,
      ttlSeconds: 120,
      producer: () => saleService.list(companyId, {
        page: parsedPage > 0 ? parsedPage : 1,
        limit: parsedLimit > 0 ? parsedLimit : 25,
        startDate,
        endDate
      })
    });

    res.setHeader('X-Cache', status);
    res.setHeader('X-Cache-Ttl', '120');
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
      date: parseDateInput(date)
    };

    // Validar se a data é válida
    if (isNaN(formattedData.date.getTime())) {
      formattedData.date = new Date();
    }

    const sale = await saleService.create(companyId, userId, formattedData);
    await cacheBumpVersion({ companyId, resource: 'sales' });
    return res.status(201).json(sale);
  }),

  update: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const { date, ...rest } = req.body;

    const formattedData = {
      ...rest,
      date: parseDateInput(date)
    };

    // Validar se a data é válida
    if (isNaN(formattedData.date.getTime())) {
      formattedData.date = new Date();
    }

    const sale = await saleService.update(companyId, userId, id, formattedData);
    await cacheBumpVersion({ companyId, resource: 'sales' });
    return res.json(sale);
  }),

  delete: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const result = await saleService.delete(companyId, userId, id);
    await cacheBumpVersion({ companyId, resource: 'sales' });
    return res.json(result);
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const { statusId, installments } = req.body;
    const sale = await saleService.updateStatus(companyId, userId, id, statusId, installments);
    await cacheBumpVersion({ companyId, resource: 'sales' });
    return res.json(sale);
  }),

  generateReceivables: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const { id: userId } = req.user;
    const { id } = req.params;
    const sale = await saleService.generateReceivables(companyId, userId, id, req.validatedBody || {});
    await cacheBumpVersion({ companyId, resource: 'sales' });
    await cacheBumpVersion({ companyId, resource: 'financialRecords' });
    await cacheBumpVersion({ companyId, resource: 'bankStatement' });
    return res.json(sale);
  }),
};
