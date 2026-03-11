import { z } from 'zod';

export const createMovementSchema = z.object({
    productId: z.string().uuid("ID do produto inválido"),
    warehouseId: z.string().uuid("ID do depósito inválido"),
    type: z.enum(['IN', 'OUT', 'RESERVE', 'RELEASE_RESERVE'], { 
        errorMap: () => ({ message: "O tipo de movimento é inválido" }) 
    }),
    quantity: z.number().int().positive("A quantidade deve ser maior que zero"),
    unitCost: z.number().nonnegative().optional(),
    reason: z.string().min(3, "Razão/Justificativa obrigatória (mín. 3 caracteres)"),
    documentRef: z.string().optional(),
    description: z.string().optional(),
});