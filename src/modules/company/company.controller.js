import { createCompanyService, listCompaniesService } from './company.service.js'

// Criar empresa
export async function createCompanyController(req, res) {
  try {
    const { name } = req.body
    const userId = req.user.id // do token JWT
    const company = await createCompanyService(userId, name)
    return res.status(201).json(company)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}

// Listar empresas
export async function listCompaniesController(req, res) {
  try {
    const userId = req.user.id
    const companies = await listCompaniesService(userId)
    return res.json(companies)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}
