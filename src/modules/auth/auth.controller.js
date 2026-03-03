import { register, login, refreshUserToken } from './auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// Criar usuário
export const registerController = asyncHandler(async (req, res) => {
    await register(req.body);
    
    // Faz o login automático para retornar o accessToken (necessário para criar a company) e userId
    const tokens = await login({ email: req.body.email, password: req.body.password });
    
    return res.status(201).json({
        message: "Usuário criado com sucesso",
        ...tokens
    });
});

// Login
export const loginController = asyncHandler(async (req, res) => {
    const tokens = await login(req.body);
    return res.json(tokens);
});

// Refresh Token
export const refreshController = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const newToken = await refreshUserToken(refreshToken);
    return res.json(newToken);
});