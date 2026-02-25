import { createTag, deleteTag, getAllTag, getTagById, updateTag } from "./tag.service.js";

export async function createController(req, res) {
    const companyId = req.companyId

    try {
        const tag = await createTag(companyId, req.validatedBody);

        return res.status(200).json(tag);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }

}

export async function getAllController(req, res) {
    const companyId = req.companyId;

    try {
        const tag = await getAllTag(companyId);

        return res.status(200).json(tag)
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function getByIdController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const tag = await getTagById(companyId, id)

        return res.status(200).json(tag);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function updateController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;
    
    try {
        const tag = await updateTag(companyId, id, req.validatedBody);

        return res.status(200).json(tag);
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}

export async function deleteController(req, res) {
    const companyId = req.companyId;
    const { id } = req.params;

    try {
        const tag = await deleteTag(companyId, id);

        return res.status(200).json(tag)
    } catch(error) {
        return res.status(500).json({ error: error.message })
    }
}