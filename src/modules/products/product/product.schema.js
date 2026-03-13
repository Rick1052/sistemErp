import { z } from 'zod';

export const createProductSchema = z.object({
  // --- Identificação e Textos ---
  code: z.string().trim().max(50).optional().nullable(),
  description: z
    .string()
    .trim()
    .min(2, "A descrição deve ter no mínimo 2 caracteres")
    .max(255, "Descrição muito longa"),
  shortDescription: z.string().trim().max(100).optional().nullable(),

  // --- Preços ---
  price: z.coerce
    .number()
    .positive("O preço deve ser maior que zero")
    .finite(),
  costPrice: z.coerce
    .number()
    .nonnegative("O preço de custo não pode ser negativo")
    .optional()
    .nullable(),

  // --- Relacionamentos (IDs) ---
  supplierId: z.string().uuid("ID de fornecedor inválido").optional().nullable(),
  brandId: z.string().uuid("ID de marca inválido").optional().nullable(),
  categoryId: z.string().uuid("ID de categoria inválido").optional().nullable(),

  // --- Dimensões (Floats) ---
  weight: z.coerce.number().nonnegative().optional().nullable(),
  width: z.coerce.number().nonnegative().optional().nullable(),
  height: z.coerce.number().nonnegative().optional().nullable(),
  depth: z.coerce.number().nonnegative().optional().nullable(),

  // --- Outros ---
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  
  // Para Tags
  tagIds: z.array(z.string().uuid()).optional().default([]),

}).strict();

export const updateProductSchema = createProductSchema.partial().strict();