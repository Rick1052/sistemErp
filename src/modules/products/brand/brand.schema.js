import { z } from 'zod';

export const createBrandSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Nome deve ter no mínimo 2 caracteres")
        .max(55, "Nome deve ter no máximo 55 caracteres"),

}).strict();

export const updateBrandSchema = createBrandSchema.optional() 