import { ca } from "zod/locales";
import { createCategory, deleteCategory, getAllCategory, getCategoryById, updateCategory } from "./category.service.js";

export async function createController(req, res) {
    const companyId = req.companyId;
    const parentId = req.parentId

    try {
        const category = await createCategory(companyId, parentId, req.validatedBody);

        return res.status(200).json(category);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export async function listController(req, res) {
    
    const companyId = req.companyId;
    
    try {
        const category = await getAllCategory(companyId);

        return res.status(200).json(category);

    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function getByIdController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const company = await getCategoryById(companyId, id);

        return res.status(200).json(company);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
    
}

export async function updateController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const category = await updateCategory(companyId, id, req.validatedBody);

        return res.status(200).json(category);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function deleteController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const company = await deleteCategory(companyId, id);

        return res.status(200).json(company);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}