import { z } from "zod";

export const loginSchema = z.object({
    // Removida validação estrita .email() para aceitar o padrão nome@empresa
    email: z.string().min(1, 'Identificador é obrigatório'),
    // Senha com mínimo de 6 caracteres
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
    // CompanyId flexível
    companyId: z.string().uuid().optional().nullable().or(z.literal('')),
});

export const registerSchema = z.object({
    name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
    // No registro também removemos a validação de formato e-mail para manter consistência
    email: z.string().min(1, 'O identificador/email deve ser preenchido').refine(v => v.includes('@'), { message: 'O identificador deve conter @' }),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});