import { createWarehouse, deleteWarehouse, getAllWarehouse, getWarehouseById, updateWarehouse } from "./warehouse.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { cacheGetOrSetJSON, cacheKeyFromReq } from "../../../utils/cache.js";
import { cacheBumpVersion } from "../../../utils/cache.js";

export const createController = asyncHandler(async (req, res) => {
    const warehouse = await createWarehouse(req.companyId, req.validatedBody);
    await cacheBumpVersion({ companyId: req.companyId, resource: "warehouses" });
    res.status(201).json(warehouse);
});

export const getAllController = asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
        companyId: req.companyId,
        resource: "warehouses",
        query: req.query,
    });

    const warehouses = await cacheGetOrSetJSON({
        key,
        ttlSeconds: 300,
        producer: () => getAllWarehouse(req.companyId),
    });
    res.status(200).json(warehouses);
});

export const getByIdController = asyncHandler(async (req, res) => {
    const warehouse = await getWarehouseById(req.companyId, req.params.id);
    res.status(200).json(warehouse);
});

export const updateController = asyncHandler(async (req, res) => {
    const warehouse = await updateWarehouse(req.companyId, req.params.id, req.validatedBody);
    await cacheBumpVersion({ companyId: req.companyId, resource: "warehouses" });
    res.status(200).json(warehouse);
});

export const deleteController = asyncHandler(async (req, res) => {
    await deleteWarehouse(req.companyId, req.params.id);
    await cacheBumpVersion({ companyId: req.companyId, resource: "warehouses" });
    res.status(200).json({ message: "Depósito removido com sucesso" });
});