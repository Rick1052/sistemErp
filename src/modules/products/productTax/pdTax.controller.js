import { createTax, getTaxByProductId, updateTaxByProductId } from "./pdTax.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const tax = await createTax(req.companyId, req.validatedBody);
    res.status(201).json(tax);
});

// A rota será GET /product-tax/:productId
export const getByProductIdController = asyncHandler(async (req, res) => {
    const tax = await getTaxByProductId(req.companyId, req.params.productId);
    res.status(200).json(tax);
});

// A rota será PUT /product-tax/:productId
export const updateController = asyncHandler(async (req, res) => {
    const tax = await updateTaxByProductId(req.companyId, req.params.productId, req.validatedBody);
    res.status(200).json(tax);
});