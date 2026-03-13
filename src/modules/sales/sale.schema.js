import { z } from 'zod';

export const createSaleSchema = z.object({
  clientId: z.string().uuid(),
  statusId: z.string().uuid(),
  paymentMethodId: z.string().uuid().optional(),
  discount: z.coerce.number().min(0).optional().default(0),
  freight: z.coerce.number().min(0).optional().default(0),
  installments: z.array(z.object({
    paymentMethodId: z.string().uuid(),
    amount: z.coerce.number().positive(),
    dueDate: z.string().or(z.date()),
  })).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().min(0),
    discount: z.coerce.number().min(0).optional().default(0),
  })).min(1, 'O pedido deve ter pelo menos um item'),
});

export const updateSaleStatusSchema = z.object({
  statusId: z.string().uuid(),
});
