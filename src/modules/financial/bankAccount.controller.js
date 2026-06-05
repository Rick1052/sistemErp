import { bankAccountService } from './bankAccount.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { cacheGetOrSetJSONWithStatus, cacheKeyFromReq } from '../../utils/cache.js';
import { cacheBumpVersion } from '../../utils/cache.js';

export const bankAccountController = {
  list: asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
      companyId: req.companyId,
      resource: 'bankAccounts',
      query: req.query,
    });

    const { value: accounts, status } = await cacheGetOrSetJSONWithStatus({
      key,
      ttlSeconds: 3600,
      producer: () => bankAccountService.list(req.companyId),
    });

    res.setHeader('X-Cache', status);
    res.setHeader('X-Cache-Ttl', '3600');
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

  transfer: asyncHandler(async (req, res) => {
    const result = await bankAccountService.transferBetweenAccounts(
      req.companyId,
      req.validatedBody || req.body
    );
    await cacheBumpVersion({ companyId: req.companyId, resource: 'bankAccounts' });
    await cacheBumpVersion({ companyId: req.companyId, resource: 'bankStatement' });
    res.status(200).json(result);
  }),

  getStatement: asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
      companyId: req.companyId,
      resource: 'bankStatement',
      query: { ...req.query, accountId: req.params.id },
    });

    const { value: statement, status } = await cacheGetOrSetJSONWithStatus({
      key,
      ttlSeconds: 120,
      producer: () => bankAccountService.getStatement(req.companyId, req.params.id, req.query),
    });

    res.setHeader('X-Cache', status);
    res.setHeader('X-Cache-Ttl', '120');
    res.json(statement);
  }),
};
