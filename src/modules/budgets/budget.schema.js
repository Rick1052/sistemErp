import { z } from 'zod';

const budgetItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional().default(0),
});

export const createBudgetSchema = z.object({
  clientId: z.string().uuid(),
  sellerId: z.string().uuid().optional().nullable(),
  status: z.enum(['DRAFT', 'OPEN', 'SENT', 'NEGOTIATION', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED']).optional(),
  date: z.string().optional(),
  validUntil: z.string().optional().nullable(),
  discount: z.number().nonnegative().optional().default(0),
  freight: z.number().nonnegative().optional().default(0),
  notes: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  leadOrigin: z.string().optional().nullable(),
  competitor: z.string().optional().nullable(),
  lossReason: z.string().optional().nullable(),
  commercialNotes: z.string().optional().nullable(),
  items: z.array(budgetItemSchema).min(1),
});

export const updateBudgetSchema = createBudgetSchema;

export const updateBudgetStatusSchema = z.object({
  status: z.enum(['DRAFT', 'OPEN', 'SENT', 'NEGOTIATION', 'APPROVED', 'REJECTED', 'EXPIRED']),
  lossReason: z.string().optional().nullable(),
  commercialNotes: z.string().optional().nullable(),
});
