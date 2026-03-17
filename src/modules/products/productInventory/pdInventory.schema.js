import { z } from 'zod';

export const createInventorySchema = z.object({
    productId: z.string().uuid("ID do produto inválido"),
    warehouseId: z.string().uuid("ID do depósito inválido"),
    quantity: z.coerce.number().default(0),
    minStock: z.coerce.number().optional().nullable().or(z.literal('')),
    maxStock: z.coerce.number().optional().nullable().or(z.literal('')),
});

// Na atualização, normalmente só alteramos mínimos e máximos via CRUD.
// Quantidade costuma ser atualizada via Movimentação de Estoque.
export const updateInventorySchema = createInventorySchema.omit({ productId: true, warehouseId: true });