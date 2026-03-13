import { financialRecordService } from './financialRecord.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const financialRecordController = {
  list: asyncHandler(async (req, res) => {
    const records = await financialRecordService.list(req.companyId, req.query);
    res.json(records);
  }),

  getById: asyncHandler(async (req, res) => {
    const record = await financialRecordService.getById(req.companyId, req.params.id);
    res.json(record);
  }),

  create: asyncHandler(async (req, res) => {
    const record = await financialRecordService.create(req.companyId, req.body);
    res.status(201).json(record);
  }),

  update: asyncHandler(async (req, res) => {
    const record = await financialRecordService.update(req.companyId, req.params.id, req.body);
    res.json(record);
  }),

  pay: asyncHandler(async (req, res) => {
    const record = await financialRecordService.pay(req.companyId, req.params.id, req.body);
    res.json({ message: 'Título baixado com sucesso', record });
  }),

  cancel: asyncHandler(async (req, res) => {
    const record = await financialRecordService.cancel(req.companyId, req.params.id);
    res.json({ message: 'Título cancelado com sucesso', record });
  }),

  delete: asyncHandler(async (req, res) => {
    await financialRecordService.delete(req.companyId, req.params.id);
    res.status(204).send();
  }),
};
