import { createWarehouse, deleteWarehouse, getAllWarehouse, getWarehouseById, updateWarehouse } from "./warehouse.service.js";

export async function createController(req, res) {
    const companyId = req.companyId

    try {
        const warehouse = await createWarehouse(companyId, req.validatedBody);

        return res.status(200).json(warehouse);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }

}

export async function getAllController(req, res) {
    const companyId = req.companyId;

    try {
        const warehouse = await getAllWarehouse(companyId);

        return res.status(200).json(warehouse)
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function getByIdController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const warehouse = await getWarehouseById(companyId, id)

        return res.status(200).json(warehouse);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function updateController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;
    
    try {
        const warehouse = await updateWarehouse(companyId, id, req.validatedBody);

        return res.status(200).json(warehouse);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function deleteController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const warehouse = await deleteWarehouse(companyId, id);

        return res.status(200).json(warehouse)
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}