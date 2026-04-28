import { bankAccountService } from './bankAccount.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { cacheGetOrSetJSON, cacheKeyFromReq } from '../../utils/cache.js';
import { cacheBumpVersion } from '../../utils/cache.js';

export const bankAccountController = {
  list: asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
      companyId: req.companyId,
      resource: 'bankAccounts',
      query: req.query,
    });

    const accounts = await cacheGetOrSetJSON({
      key,
      ttlSeconds: 3600,
      producer: () => bankAccountService.list(req.companyId),
    });

    res.json(accounts);
  }),

  getById: asyncHandler(async (req, res) => {
    const account = await bankAccountService.getById(req.companyId, req.params.id);
    res.json(account);
  }),

  create: asyncHandler(async (req, res) => {
    const account = await bankAccountService.create(req.companyId, req.body);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'bankAccounts' });
    res.status(201).json(account);
  }),

  update: asyncHandler(async (req, res) => {
    const account = await bankAccountService.update(req.companyId, req.params.id, req.body);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'bankAccounts' });
    res.json(account);
  }),

  delete: asyncHandler(async (req, res) => {
    await bankAccountService.delete(req.companyId, req.params.id);
    await cacheBumpVersion({ companyId: req.companyId, resource: 'bankAccounts' });
    res.status(204).send();
  }),

  getStatement: asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
      companyId: req.companyId,
      resource: 'bankStatement',
      query: { ...req.query, accountId: req.params.id },
    });

    const statement = await cacheGetOrSetJSON({
      key,
      ttlSeconds: 120,
      producer: () => bankAccountService.getStatement(req.companyId, req.params.id, req.query),
    });

    res.json(statement);
  }),
};
