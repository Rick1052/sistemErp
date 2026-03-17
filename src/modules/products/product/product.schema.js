import { z } from 'zod';

export const createProductSchema = z.object({
  // --- Identificação e Textos ---
  code: z.string().trim().max(50).optional().nullable().or(z.literal('')),
  description: z
    .string()
    .trim()
    .min(2, "A descrição deve ter no mínimo 2 caracteres")
    .max(255, "Descrição muito longa"),
  shortDescription: z.string().trim().max(100).optional().nullable().or(z.literal('')),

  // --- Preços ---
  price: z.coerce
    .number()
    .positive("O preço deve ser maior que zero")
    .finite(),
  costPrice: z.coerce
    .number()
    .nonnegative("O preço de custo não pode ser negativo")
    .optional()
    .nullable()
    .or(z.literal('')),

  // --- Relacionamentos (IDs) ---
  supplierId: z.string().uuid("ID de fornecedor inválido").optional().nullable().or(z.literal('')),
  brandId: z.string().uuid("ID de marca inválido").optional().nullable().or(z.literal('')),
  categoryId: z.string().uuid("ID de categoria inválido").optional().nullable().or(z.literal('')),

  // --- Dimensões (Floats) ---
  weight: z.coerce.number().nonnegative().optional().nullable().or(z.literal('')),
  width: z.coerce.number().nonnegative().optional().nullable().or(z.literal('')),
  height: z.coerce.number().nonnegative().optional().nullable().or(z.literal('')),
  depth: z.coerce.number().nonnegative().optional().nullable().or(z.literal('')),

  // --- Outros ---
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),

  // Para Tags
  tagIds: z.array(z.string().uuid()).optional().default([]),

}).passthrough(); // Alterado de strict() para passthrough() para não dar erro com campos de estoque/fiscal que vêm do form

export const updateProductSchema = createProductSchema.partial();