import { z } from 'zod';

export const createMovementSchema = z.object({
    productId: z.string().uuid("ID do produto inválido"),
    warehouseId: z.string().uuid("ID do depósito inválido"),
    type: z.enum(['IN', 'OUT', 'BALANCE'], { 
        errorMap: () => ({ message: "O tipo deve ser IN, OUT ou BALANCE" }) 
    }),
    quantity: z.number().int().nonnegative("A quantidade não pode ser negativa"),
    description: z.string().optional(),
});