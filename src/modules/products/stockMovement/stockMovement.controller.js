import { createStockMovement, getStockMovements } from "./stockMovement.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const movement = await createStockMovement(
        req.companyId, 
        req.user.id, 
        req.validatedBody
    );
    
    res.status(201).json({
        message: "Movimentação processada com sucesso",
        movement
    });
});

export const listController = asyncHandler(async (req, res) => {
    // Pegamos possíveis filtros da query string (ex: /movements?productId=123)
    const filters = {
        productId: req.query.productId,
        warehouseId: req.query.warehouseId
    };

    const movements = await getStockMovements(req.companyId, filters);
    res.status(200).json(movements);
});