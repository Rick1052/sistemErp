import { createSupplier, deleteSupplier, getAllSupplier, getSupplierById, updateSupplier } from "./supplier.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const supplier = await createSupplier(req.companyId, req.validatedBody);
    res.status(201).json(supplier);
});

export const getAllController = asyncHandler(async (req, res) => {
    const suppliers = await getAllSupplier(req.companyId);
    res.status(200).json(suppliers);
});

export const getByIdController = asyncHandler(async (req, res) => {
    const supplier = await getSupplierById(req.companyId, req.params.id);
    res.status(200).json(supplier);
});

export const updateController = asyncHandler(async (req, res) => {
    const supplier = await updateSupplier(req.companyId, req.params.id, req.validatedBody);
    res.status(200).json(supplier);
});

export const deleteController = asyncHandler(async (req, res) => {
    await deleteSupplier(req.companyId, req.params.id);
    res.status(200).json({ message: "Fornecedor removido com sucesso" });
});