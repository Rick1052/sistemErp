import { createProduct, deleteProduct, getAllProducts, getProductById, updateProduct } from "./product.service.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const createController = asyncHandler(async (req, res) => {
    const { tagIds, ...productData } = req.validatedBody;
    const product = await createProduct(req.companyId, tagIds, productData);

    res.status(201).json(product);
});

export const getAllController = asyncHandler(async (req, res) => {
    const { search, page, limit } = req.query;

    const result = await getAllProducts(req.companyId, {
        search,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined
    });

    // Inject dynamic availableStock property
    const productsWithAvailableStock = result.products.map(product => ({
        ...product,
        availableStock: (product.physicalStock || 0) - (product.reservedStock || 0)
    }));

    res.status(200).json({
        products: productsWithAvailableStock,
        meta: result.meta
    });
});

export const getByIdController = asyncHandler(async (req, res) => {
    const product = await getProductById(req.companyId, req.params.id);

    // Inject dynamic availableStock property
    const productWithAvailableStock = {
        ...product,
        availableStock: (product.physicalStock || 0) - (product.reservedStock || 0)
    };

    res.status(200).json(productWithAvailableStock);
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