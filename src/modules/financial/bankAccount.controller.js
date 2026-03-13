import { bankAccountService } from './bankAccount.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const bankAccountController = {
  list: asyncHandler(async (req, res) => {
    const accounts = await bankAccountService.list(req.companyId);
    res.json(accounts);
  }),

  getById: asyncHandler(async (req, res) => {
    const account = await bankAccountService.getById(req.companyId, req.params.id);
    res.json(account);
  }),

  create: asyncHandler(async (req, res) => {
    const account = await bankAccountService.create(req.companyId, req.body);
    res.status(201).json(account);
  }),

  update: asyncHandler(async (req, res) => {
    const account = await bankAccountService.update(req.companyId, req.params.id, req.body);
    res.json(account);
  }),

  delete: asyncHandler(async (req, res) => {
    await bankAccountService.delete(req.companyId, req.params.id);
    res.status(204).send();
  }),

  getStatement: asyncHandler(async (req, res) => {
    const statement = await bankAccountService.getStatement(req.companyId, req.params.id, req.query);
    res.json(statement);
  }),
};
