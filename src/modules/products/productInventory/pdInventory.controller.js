import { createInventory, getInventoryByProduct, updateInventory } from "./pdInventory.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const inventory = await createInventory(req.companyId, req.validatedBody);
    res.status(201).json(inventory);
});

// Rota GET /product-inventory/:productId
export const getByProductController = asyncHandler(async (req, res) => {
    const inventories = await getInventoryByProduct(req.companyId, req.params.productId);
    res.status(200).json(inventories);
});

// Rota PUT /product-inventory/:id (Usa o ID da própria linha de inventário)
export const updateController = asyncHandler(async (req, res) => {
    const inventory = await updateInventory(req.companyId, req.params.id, req.validatedBody);
    res.status(200).json(inventory);
});