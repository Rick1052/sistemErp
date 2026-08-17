import { register, login, refreshUserToken, switchCompany } from './auth.service.js';
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
    const { refreshToken, companyId } = req.validatedBody;
    const newToken = await refreshUserToken(refreshToken, companyId);
    return res.json(newToken);
});

export const switchCompanyController = asyncHandler(async (req, res) => {
    const session = await switchCompany(req.user.id, req.validatedBody.companyId);
    return res.json(session);
});
