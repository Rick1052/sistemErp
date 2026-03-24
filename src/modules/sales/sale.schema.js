import { z } from 'zod';

const robustNumber = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}, z.number());

export const createSaleSchema = z.object({
  clientId: z.string().uuid(),
  statusId: z.string().uuid(),
  paymentMethodId: z.string().uuid().optional(),
  date: z.coerce.date().optional(),
  discount: robustNumber.optional().default(0),
  freight: robustNumber.optional().default(0),
  installments: z.array(z.object({
    paymentMethodId: z.string().uuid(),
    amount: robustNumber,
    dueDate: z.string().or(z.date()),
  })).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: robustNumber.int().positive(),
    unitPrice: robustNumber,
    discount: robustNumber.optional().default(0),
  })).min(1, 'O pedido deve ter pelo menos um item'),
});

export const updateSaleStatusSchema = z.object({
  statusId: z.string().uuid(),
});
