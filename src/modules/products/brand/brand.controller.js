import { createBrand, deleteBrand, getAllBrand, getBrandById, updateBrand } from "./brand.service.js";

export async function createController(req, res) {
    const companyId = req.companyId

    try {
        const brand = await createBrand(companyId, req.validatedBody);

        return res.status(200).json(brand);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }

}

export async function getAllController(req, res) {
    const companyId = req.companyId;

    try {
        const brand = await getAllBrand(companyId);

        return res.status(200).json(brand)
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function getByIdController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const brand = await getBrandById(companyId, id)

        return res.status(200).json(brand);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function updateController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;
    
    try {
        const brand = await updateBrand(companyId, id, req.validatedBody);

        return res.status(200).json(brand);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function deleteController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const brand = await deleteBrand(companyId, id);

        return res.status(200).json(brand)
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}