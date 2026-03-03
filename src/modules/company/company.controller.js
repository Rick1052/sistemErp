import { createCompanyService, listCompaniesService } from './company.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// Criar empresa
export const createCompanyController = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const userId = req.user.id; // Injetado pelo authMiddleware

    const company = await createCompanyService(userId, name);
    
    return res.status(201).json(company);
});

// Listar empresas
export const listCompaniesController = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    const companies = await listCompaniesService(userId);
    
    return res.status(200).json(companies);
});