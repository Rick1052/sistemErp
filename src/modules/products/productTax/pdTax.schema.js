import { z } from 'zod';

export const createProductTaxSchema = z.object({
    productId: z.string().uuid("ID do produto inválido"),
    origin: z.string().optional(),
    ipiTaxClass: z.string().optional(),
    icmsStBase: z.number().nonnegative().optional(),
    icmsStAmount: z.number().nonnegative().optional(),
    icmsOwnAmount: z.number().nonnegative().optional(),
});

export const updateProductTaxSchema = createProductTaxSchema.omit({ productId: true });