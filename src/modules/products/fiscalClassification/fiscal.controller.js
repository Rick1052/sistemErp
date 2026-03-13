import { createFiscal, listFiscals, getFiscalById, updateFiscal, deleteFiscal } from "./fiscal.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const fiscal = await createFiscal(req.companyId, req.validatedBody);
    res.status(201).json(fiscal);
});

export const listController = asyncHandler(async (req, res) => {
    const fiscals = await listFiscals(req.companyId);
    res.status(200).json(fiscals);
});

export const getByIdController = asyncHandler(async (req, res) => {
    const fiscal = await getFiscalById(req.companyId, req.params.id);
    res.status(200).json(fiscal);
});

export const updateController = asyncHandler(async (req, res) => {
    const fiscal = await updateFiscal(req.companyId, req.params.id, req.validatedBody);
    res.status(200).json(fiscal);
});

export const deleteController = asyncHandler(async (req, res) => {
    await deleteFiscal(req.companyId, req.params.id);
    res.status(200).json({ message: "Classificação fiscal removida com sucesso" });
});
