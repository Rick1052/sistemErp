import { registerEntry, registerExit, getStockMovements } from "./stockMovement.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { AppError } from "../../../utils/AppError.js";

export const createController = asyncHandler(async (req, res) => {
    const { type, ...movementData } = req.validatedBody;
    
    let movement;

    if (type === 'IN') {
        movement = await registerEntry(
            req.companyId,
            req.user.id,
            movementData
        );
    } else if (type === 'OUT') {
        movement = await registerExit(
            req.companyId,
            req.user.id,
            movementData
        );
    } else {
        throw new AppError("Apenas movimentações IN e OUT são permitidas manualmente", 400);
    }
    
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