import { createCompanyService, listCompaniesService, updateCompanyService } from './company.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { cacheBumpVersion } from '../../utils/cache.js';

// Criar empresa
export const createCompanyController = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const userId = req.user.id; // Injetado pelo authMiddleware

    const company = await createCompanyService(userId, name);
    // Cache da lista é por usuário — invalida o do próprio usuário
    await cacheBumpVersion({ companyId: userId, resource: 'company' });

    return res.status(201).json(company);
});

// Listar empresas
export const listCompaniesController = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    const companies = await listCompaniesService(userId);
    
    return res.status(200).json(companies);
});

// Atualizar empresa
export const updateCompanyController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const userId = req.user.id;

    const company = await updateCompanyService(userId, id, data);
    await cacheBumpVersion({ companyId: userId, resource: 'company' });

    return res.status(200).json(company);
});