import { createProduct, deleteProduct, getAllProducts, getProductById, updateProduct } from "./product.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const { tagIds, ...productData } = req.validatedBody;
    const product = await createProduct(req.companyId, tagIds, productData);
    
    res.status(201).json(product);
});

export const getAllController = asyncHandler(async (req, res) => {
    const products = await getAllProducts(req.companyId);
    res.status(200).json(products);
});

export const getByIdController = asyncHandler(async (req, res) => {
    const product = await getProductById(req.companyId, req.params.id);
    res.status(200).json(product);
});

export const updateController = asyncHandler(async (req, res) => {
    const { tagIds, ...productData } = req.validatedBody;
    const product = await updateProduct(req.companyId, req.params.id, productData, tagIds);
    
    res.status(200).json(product);
});

export const deleteController = asyncHandler(async (req, res) => {
    await deleteProduct(req.companyId, req.params.id);
    res.status(200).json({ message: "Produto removido com sucesso" });
});