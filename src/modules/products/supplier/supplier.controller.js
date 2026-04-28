import { createSupplier, deleteSupplier, getAllSupplier, getSupplierById, updateSupplier } from "./supplier.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { cacheBumpVersion, cacheGetOrSetJSON, cacheKeyFromReq } from "../../../utils/cache.js";

export const createController = asyncHandler(async (req, res) => {
    const supplier = await createSupplier(req.companyId, req.validatedBody);
    await cacheBumpVersion({ companyId: req.companyId, resource: "suppliers" });
    res.status(201).json(supplier);
});

export const getAllController = asyncHandler(async (req, res) => {
    const { search, page, limit } = req.query;

    const parsedPage = parseInt(page) || 1;
    const parsedLimit = parseInt(limit) || 25;

    const key = await cacheKeyFromReq({
        companyId: req.companyId,
        resource: "suppliers",
        query: req.query,
    });

    const result = await cacheGetOrSetJSON({
        key,
        ttlSeconds: 60,
        producer: () => getAllSupplier(req.companyId, {
            search: search ? String(search) : undefined,
            page: parsedPage > 0 ? parsedPage : 1,
            limit: parsedLimit > 0 ? parsedLimit : 25
        })
    });
    
    res.status(200).json({
        suppliers: result.suppliers || [],
        meta: result.meta || { total: 0, page: parsedPage, limit: parsedLimit, totalPages: 0 }
    });
});

export const getByIdController = asyncHandler(async (req, res) => {
    const supplier = await getSupplierById(req.companyId, req.params.id);
    res.status(200).json(supplier);
});

export const updateController = asyncHandler(async (req, res) => {
    const supplier = await updateSupplier(req.companyId, req.params.id, req.validatedBody);
    await cacheBumpVersion({ companyId: req.companyId, resource: "suppliers" });
    res.status(200).json(supplier);
});

export const deleteController = asyncHandler(async (req, res) => {
    await deleteSupplier(req.companyId, req.params.id);
    await cacheBumpVersion({ companyId: req.companyId, resource: "suppliers" });
    res.status(200).json({ message: "Fornecedor removido com sucesso" });
});