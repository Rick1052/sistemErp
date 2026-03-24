import { z } from 'zod';

const robustNumber = (schema = z.number()) => z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}, schema);

const robustUUID = (isRequired = false) => z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  return val;
}, isRequired ? z.string().uuid() : z.string().uuid().optional());

export const createSaleSchema = z.object({
  clientId: robustUUID(true),
  statusId: robustUUID(true),
  paymentMethodId: robustUUID(false),
  date: z.coerce.date().optional(),
  discount: robustNumber().optional().default(0),
  freight: robustNumber().optional().default(0),
  installments: z.array(z.object({
    paymentMethodId: robustUUID(true),
    amount: robustNumber(),
    dueDate: z.string().or(z.date()),
  })).optional(),
  items: z.array(z.object({
    productId: robustUUID(true),
    quantity: robustNumber(z.number().int().positive()),
    unitPrice: robustNumber(),
    discount: robustNumber().optional().default(0),
  })).min(1, 'O pedido deve ter pelo menos um item'),
  // Campos de cheque (passados para o financeiro, mas não salvos na Venda)
  chequeNumber: z.string().optional(),
  chequeOwner: z.string().optional(),
  chequeDueDate: z.coerce.date().optional().or(z.string().optional()),
  chequeCustomerId: robustUUID(false),
});

export const updateSaleStatusSchema = z.object({
  statusId: z.string().uuid(),
});
