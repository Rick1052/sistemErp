import {
  createClient,
  getAllClients,
  getClientById,
  deleteClient,
  updateClient,
  deleteManyClient
} from "./client.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { cacheBumpVersion, cacheGetOrSetJSON, cacheKeyFromReq } from '../../utils/cache.js';

export const createController = asyncHandler(async (req, res) => {
  const client = await createClient(req.companyId, req.validatedBody);
  await cacheBumpVersion({ companyId: req.companyId, resource: 'clients' });
  return res.status(201).json(client);
});

export const listController = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;

  const parsedPage = parseInt(page) || 1;
  const parsedLimit = parseInt(limit) || 25;

  const key = await cacheKeyFromReq({
    companyId: req.companyId,
    resource: 'clients',
    query: req.query,
  });

  const result = await cacheGetOrSetJSON({
    key,
    ttlSeconds: 300,
    producer: () =>
      getAllClients(req.companyId, {
        search: search ? String(search) : undefined,
        page: parsedPage > 0 ? parsedPage : 1,
        limit: parsedLimit > 0 ? parsedLimit : 25,
      }),
  });

  // Ensure result has the expected properties
  return res.status(200).json({
    clients: result.clients || [],
    meta: result.meta || { total: 0, page: parsedPage, limit: parsedLimit, totalPages: 0 }
  });
});

export const getByIdController = asyncHandler(async (req, res) => {
  const client = await getClientById(req.companyId, req.params.id);
  return res.status(200).json(client);
});

export const updateController = asyncHandler(async (req, res) => {
  const client = await updateClient(req.companyId, req.params.id, req.validatedBody);
  await cacheBumpVersion({ companyId: req.companyId, resource: 'clients' });
  return res.status(200).json(client);
});

export const deleteControler = asyncHandler(async (req, res) => {
  await deleteClient(req.companyId, req.params.id);
  await cacheBumpVersion({ companyId: req.companyId, resource: 'clients' });
  return res.status(200).json({ message: "Cliente removido com sucesso" });
});

export const deleteManyController = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      message: "Envie um array de IDs para excluir"
    });
  }

  await deleteManyClient(req.companyId, ids);
  await cacheBumpVersion({ companyId: req.companyId, resource: 'clients' });

  return res.status(200).json({
    message: "Clientes removidos com sucesso"
  });
});