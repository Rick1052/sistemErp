import { register, login, refreshUserToken } from './auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// Criar usuário
export const registerController = asyncHandler(async (req, res) => {
    // register is an async function, good.
    const user = await register(req.validatedBody);

    // login also async
    const tokens = await login({
        email: req.validatedBody.email,
        password: req.validatedBody.password
    });

    return res.status(201).json({
        message: "Usuário criado com sucesso",
        ...tokens
    });
});

// Login
export const loginController = asyncHandler(async (req, res) => {
    const tokens = await login(req.validatedBody);
    return res.json(tokens);
});

// Refresh Token
export const refreshController = asyncHandler(async (req, res) => {
    const { refreshToken } = req.validatedBody;
    const newToken = await refreshUserToken(refreshToken);
    return res.json(newToken);
});