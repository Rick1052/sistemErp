import { z } from 'zod';

export const createInventorySchema = z.object({
    productId: z.string().uuid("ID do produto inválido"),
    warehouseId: z.string().uuid("ID do depósito inválido"),
    quantity: z.number().int().nonnegative("A quantidade não pode ser negativa").default(0),
    minStock: z.number().int().nonnegative().optional(),
    maxStock: z.number().int().nonnegative().optional(),
});

// Na atualização, normalmente só alteramos mínimos e máximos via CRUD.
// Quantidade costuma ser atualizada via Movimentação de Estoque.
export const updateInventorySchema = createInventorySchema.omit({ productId: true, warehouseId: true });