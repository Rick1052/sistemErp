import { z } from 'zod';

export const createProductSchema = z.object({
  // --- Identificação e Textos ---
  code: z.string().trim().max(50).optional().nullable(),
  description: z
    .string()
    .trim()
    .min(3, "A descrição deve ter no mínimo 3 caracteres")
    .max(255, "Descrição muito longa"),
  shortDescription: z.string().trim().max(100).optional().nullable(),

  // --- Preços (Convertendo string/number para Decimal seguro) ---
  // Dica: Recebemos como number ou string e validamos se é um valor monetário positivo
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
  parentId: z.string().uuid("ID do produto pai inválido").optional().nullable(),

  // --- Fiscal e Logística ---
  gtin: z.string().trim().max(14).optional().nullable(), // EAN/GTIN geralmente tem 13 ou 14 dígitos
  ncm: z.string().length(8, "NCM deve ter exatamente 8 dígitos").optional().nullable(),
  cest: z.string().length(7, "CEST deve ter exatamente 7 dígitos").optional().nullable(),

  // --- Dimensões (Floats) ---
  weight: z.coerce.number().nonnegative().optional().nullable(),
  width: z.coerce.number().nonnegative().optional().nullable(),
  height: z.coerce.number().nonnegative().optional().nullable(),
  depth: z.coerce.number().nonnegative().optional().nullable(),

  // --- Outros ---
  expirationDate: z.coerce.date().optional().nullable(),
  isVariant: z.boolean().default(false),
  
  // Para Tags, assumindo que você recebe um array de IDs
  tagIds: z.array(z.string().uuid()).optional().default([]),

}).strict(); // Bloqueia campos não mapeados no schema

// O .partial() torna TODOS os campos do schema original como opcionais
// O .omit({ ... }) garante que campos sensíveis não sejam enviados no body
export const updateProductSchema = createProductSchema.partial().omit({
    isVariant: true, // Geralmente não se muda se um produto é variante após criado
    parentId: true
}).strict();