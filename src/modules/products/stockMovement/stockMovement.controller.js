import { registerEntry, registerExit, getStockMovements } from "./stockMovement.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { AppError } from "../../../utils/AppError.js";
import { cacheGetOrSetJSON, cacheKeyFromReq } from "../../../utils/cache.js";
import { cacheBumpVersion } from "../../../utils/cache.js";

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
    await cacheBumpVersion({ companyId: req.companyId, resource: "stockMovements" });
    await cacheBumpVersion({ companyId: req.companyId, resource: "products" });
});

export const listController = asyncHandler(async (req, res) => {
    // Pegamos possíveis filtros da query string (ex: /movements?productId=123)
    const filters = {
        productId: req.query.productId,
        warehouseId: req.query.warehouseId
    };

    const key = await cacheKeyFromReq({
        companyId: req.companyId,
        resource: "stockMovements",
        query: req.query,
    });

    const movements = await cacheGetOrSetJSON({
        key,
        ttlSeconds: 120,
        producer: () => getStockMovements(req.companyId, filters),
    });

    res.status(200).json(movements);
});