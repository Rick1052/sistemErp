import { createSupplier, deleteSupplier, getAllSupplier, getSupplierById, updateSupplier } from "./supplier.service.js";

export async function createController(req, res) {
    const companyId = req.companyId;

    try {
        const supplier = await createSupplier(companyId, req.validatedBody);

        return res.status(200).json(supplier);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export async function getAllConroller(req, res) {
    const companyId = req.companyId;

    try {
        const supplier = await getAllSupplier(companyId);

        return res.status(200).json(supplier);
    } catch(error) {
        return res.status(500).json({ error: error.message });
    }
}

export async function getByIdController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const supplier = await getSupplierById(companyId, id);

        return res.status(200).json(supplier);
    } catch(error) {
        return res.status(500).json({ error: error.message });
    }
}

export async function updateController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const supplier = await updateSupplier(companyId, id, req.validatedBody);

        return res.status(200).json(supplier);
    } catch(error) {
        return res.status(500).json({ error: error.message });
    }
}

export async function deleteController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const supplier = await deleteSupplier(companyId, id);

        return res.status(200).json(supplier);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}