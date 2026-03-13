import { z } from 'zod';

export const createFiscalSchema = z.object({
    ncm: z.string().length(8, "NCM deve ter exatamente 8 dígitos"),
    description: z.string().max(255).optional().nullable(),
    cest: z.string().length(7, "CEST deve ter exatamente 7 dígitos").optional().nullable(),
});

export const updateFiscalSchema = createFiscalSchema.partial();
