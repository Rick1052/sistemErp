import { z } from 'zod';

export const createProductTaxSchema = z.object({
    productId: z.string().uuid("ID do produto inválido"),
    origin: z.string().optional().nullable(),
    ncm: z.string().optional().nullable(),
    cest: z.string().optional().nullable(),
    gtin: z.string().optional().nullable(),
    ipiTaxClass: z.string().optional().nullable(),
    icmsStBase: z.number().nonnegative().optional().nullable(),
    icmsStAmount: z.number().nonnegative().optional().nullable(),
    icmsOwnAmount: z.number().nonnegative().optional().nullable(),
});

export const updateProductTaxSchema = createProductTaxSchema.omit({ productId: true });