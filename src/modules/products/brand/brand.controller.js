import { createBrand, deleteBrand, getAllBrand, getBrandById, updateBrand } from "./brand.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const brand = await createBrand(req.companyId, req.validatedBody);
    res.status(201).json(brand);
});

export const getAllController = asyncHandler(async (req, res) => {
    const brands = await getAllBrand(req.companyId);
    res.status(200).json(brands);
});

export const getByIdController = asyncHandler(async (req, res) => {
    const brand = await getBrandById(req.companyId, req.params.id);
    res.status(200).json(brand);
});

export const updateController = asyncHandler(async (req, res) => {
    const brand = await updateBrand(req.companyId, req.params.id, req.validatedBody);
    res.status(200).json(brand);
});

export const deleteController = asyncHandler(async (req, res) => {
    await deleteBrand(req.companyId, req.params.id);
    res.status(200).json({ message: "Marca removida com sucesso" });
});