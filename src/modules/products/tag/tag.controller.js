import { createTag, deleteTag, getAllTag, getTagById, updateTag } from "./tag.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const tag = await createTag(req.companyId, req.validatedBody);
    res.status(201).json(tag);
});

export const getAllController = asyncHandler(async (req, res) => {
    const tags = await getAllTag(req.companyId);
    res.status(200).json(tags);
});

export const getByIdController = asyncHandler(async (req, res) => {
    const tag = await getTagById(req.companyId, req.params.id);
    res.status(200).json(tag);
});

export const updateController = asyncHandler(async (req, res) => {
    const tag = await updateTag(req.companyId, req.params.id, req.validatedBody);
    res.status(200).json(tag);
});

export const deleteController = asyncHandler(async (req, res) => {
    await deleteTag(req.companyId, req.params.id);
    res.status(200).json({ message: "Tag removida com sucesso" });
});