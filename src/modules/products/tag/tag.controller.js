import { createTag, deleteTag, getAllTag, getTagById, updateTag } from "./tag.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { cacheGetOrSetJSON, cacheKeyFromReq } from "../../../utils/cache.js";
import { cacheBumpVersion } from "../../../utils/cache.js";

export const createController = asyncHandler(async (req, res) => {
    const tag = await createTag(req.companyId, req.validatedBody);
    await cacheBumpVersion({ companyId: req.companyId, resource: "tags" });
    res.status(201).json(tag);
});

export const getAllController = asyncHandler(async (req, res) => {
    const key = await cacheKeyFromReq({
        companyId: req.companyId,
        resource: "tags",
        query: req.query,
    });

    const tags = await cacheGetOrSetJSON({
        key,
        ttlSeconds: 3600,
        producer: () => getAllTag(req.companyId),
    });
    res.status(200).json(tags);
});

export const getByIdController = asyncHandler(async (req, res) => {
    const tag = await getTagById(req.companyId, req.params.id);
    res.status(200).json(tag);
});

export const updateController = asyncHandler(async (req, res) => {
    const tag = await updateTag(req.companyId, req.params.id, req.validatedBody);
    await cacheBumpVersion({ companyId: req.companyId, resource: "tags" });
    res.status(200).json(tag);
});

export const deleteController = asyncHandler(async (req, res) => {
    await deleteTag(req.companyId, req.params.id);
    await cacheBumpVersion({ companyId: req.companyId, resource: "tags" });
    res.status(200).json({ message: "Tag removida com sucesso" });
});