import { financialRecordService } from './financialRecord.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseDateInput } from '../../utils/date.js';
import { cacheBumpVersion, cacheGetOrSetJSONWithStatus, cacheKeyFromReq } from '../../utils/cache.js';

export const financialRecordController = {
  list: asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
      companyId: req.companyId,
      resource: 'financialRecords',
      query: req.query,
    });

    const { value: result, status } = await cacheGetOrSetJSONWithStatus({
      key,
      ttlSeconds: 120,
      producer: () => financialRecordService.list(req.companyId, req.query),
    });

    res.setHeader('X-Cache', status);
    res.setHeader('X-Cache-Ttl', '120');
    res.json(result);
  }),

  getById: asyncHandler(async (req, res) => {
    const record = await financialRecordService.getById(req.companyId, req.params.id);
    res.json(record);
  }),

  create: asyncHandler(async (req, res) => {
    const { dueDate, amount, date, chequeNumber, chequeOwner, chequeDueDate, chequeCustomerId, clientId, supplierId, type, ...rest } = req.body;

    const data = {
      ...rest,
      type,
      amount: Number(amount || 0),
      dueDate: parseDateInput(dueDate),
      date: parseDateInput(date),
    };

    // Regra de Cliente vs Fornecedor
    if (type === 'RECEIVABLE') {
      data.clientId = clientId || null;
      data.supplierId = null;
    } else if (type === 'PAYABLE') {
      data.supplierId = supplierId || null;
      data.clientId = null;
    }

    // Validar se as datas são válidas
    if (isNaN(data.dueDate.getTime())) {
      data.dueDate = new Date();
    }
    if (isNaN(data.date.getTime())) {
      data.date = new Date();
    }

    if (chequeNumber) {
      if (!chequeOwner || !chequeDueDate) {
        return res.status(400).json({ error: 'Para registrar um cheque, é obrigatório informar o titular impresso (chequeOwner) e a data "bom para" (chequeDueDate).' });
      }
      data.chequeNumber = chequeNumber;
      data.chequeOwner = chequeOwner;
      data.chequeDueDate = parseDateInput(chequeDueDate);
      if (isNaN(data.chequeDueDate.getTime())) {
        return res.status(400).json({ error: 'A data do cheque (chequeDueDate) é inválida.' });
      }
      if (chequeCustomerId) {
        data.chequeCustomerId = chequeCustomerId;
      }
    }

    const record = await financialRecordService.create(req.companyId, data);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialRecords' });
    res.status(201).json(record);
  }),

  update: asyncHandler(async (req, res) => {
    const data = { ...req.body };

    // Regra de Cliente vs Fornecedor
    if (data.type === 'RECEIVABLE') {
      data.supplierId = null;
      if (data.clientId !== undefined) data.clientId = data.clientId || null;
    } else if (data.type === 'PAYABLE') {
      data.clientId = null;
      if (data.supplierId !== undefined) data.supplierId = data.supplierId || null;
    }

    if (data.chequeNumber) {
      if (!data.chequeOwner || !data.chequeDueDate) {
        return res.status(400).json({ error: 'Para atualizar ou manter um cheque, informe o titular (chequeOwner) e a data "bom para" (chequeDueDate).' });
      }
      data.chequeDueDate = parseDateInput(data.chequeDueDate);
      if (isNaN(data.chequeDueDate.getTime())) {
        return res.status(400).json({ error: 'A data do cheque (chequeDueDate) é inválida.' });
      }
    } else if (data.chequeNumber === null) {
      data.chequeOwner = null;
      data.chequeDueDate = null;
      data.chequeCustomerId = null;
    }

    const record = await financialRecordService.update(req.companyId, req.params.id, data);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialRecords' });
    res.json(record);
  }),

  pay: asyncHandler(async (req, res) => {
    const record = await financialRecordService.pay(req.companyId, req.params.id, req.body);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialRecords' });
    await cacheBumpVersion({ companyId: req.companyId, resource: 'bankStatement' });
    res.json({ message: 'Título baixado com sucesso', record });
  }),

  cancel: asyncHandler(async (req, res) => {
    const record = await financialRecordService.cancel(req.companyId, req.params.id);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialRecords' });
    res.json({ message: 'Título cancelado com sucesso', record });
  }),

  delete: asyncHandler(async (req, res) => {
    await financialRecordService.delete(req.companyId, req.params.id);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'financialRecords' });
    res.status(204).send();
  }),
};
