import { 
    createClient, 
    getAllClients, 
    getClientById, 
    deleteClient,
    updateClient,
    deleteManyClient
} from "./client.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const client = await createClient(req.companyId, req.validatedBody);
    return res.status(201).json(client);
});

export const listController = asyncHandler(async (req, res) => {
    const { search } = req.query;
    const clients = await getAllClients(req.companyId, search);
    return res.status(200).json(clients);
});

export const getByIdController = asyncHandler(async (req, res) => {
    const client = await getClientById(req.companyId, req.params.id);
    return res.status(200).json(client);
});

export const updateController = asyncHandler(async (req, res) => {
    const client = await updateClient(req.companyId, req.params.id, req.validatedBody);
    return res.status(200).json(client);
});

export const deleteControler = asyncHandler(async (req, res) => {
    await deleteClient(req.companyId, req.params.id);
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

  return res.status(200).json({
    message: "Clientes removidos com sucesso"
  });
});