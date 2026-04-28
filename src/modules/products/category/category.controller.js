import { createCategory, deleteCategory, getAllCategory, getCategoryById, updateCategory } from "./category.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { cacheGetOrSetJSON, cacheKeyFromReq } from "../../../utils/cache.js";
import { cacheBumpVersion } from "../../../utils/cache.js";

export const createController = asyncHandler(async (req, res) => {
    const category = await createCategory(req.companyId, req.validatedBody);
    await cacheBumpVersion({ companyId: req.companyId, resource: "categories" });
    res.status(201).json(category);
});

export const listController = asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
        companyId: req.companyId,
        resource: "categories",
        query: req.query,
    });

    const categories = await cacheGetOrSetJSON({
        key,
        ttlSeconds: 3600,
        producer: () => getAllCategory(req.companyId),
    });
    res.status(200).json(categories);
});

export const getByIdController = asyncHandler(async (req, res) => {
    const category = await getCategoryById(req.companyId, req.params.id);
    res.status(200).json(category);
});

export const updateController = asyncHandler(async (req, res) => {
    const category = await updateCategory(req.companyId, req.params.id, req.validatedBody);
    await cacheBumpVersion({ companyId: req.companyId, resource: "categories" });
    res.status(200).json(category);
});

export const deleteController = asyncHandler(async (req, res) => {
    await deleteCategory(req.companyId, req.params.id);
    await cacheBumpVersion({ companyId: req.companyId, resource: "categories" });
    res.status(200).json({ message: "Categoria removida com sucesso" });
});