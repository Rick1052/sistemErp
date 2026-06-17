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

const optionalString = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return null;
  return val;
}, z.string().nullable().optional());

export const createBudgetSchema = z.object({
  clientId: robustUUID(true),
  sellerId: robustUUID(false),
  status: z.enum(['DRAFT', 'OPEN', 'SENT', 'NEGOTIATION', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED']).optional(),
  date: z.string().optional(),
  validUntil: optionalString,
  discount: robustNumber().optional().default(0),
  freight: robustNumber().optional().default(0),
  notes: optionalString,
  paymentTerms: optionalString,
  paymentMethodId: robustUUID(false),
  leadOrigin: optionalString,
  competitor: optionalString,
  lossReason: optionalString,
  commercialNotes: optionalString,
  items: z.array(z.object({
    productId: robustUUID(true),
    quantity: robustNumber(z.number().int().positive()),
    unitPrice: robustNumber(),
    discount: robustNumber().optional().default(0),
  })).min(1, 'O orçamento deve ter pelo menos um item'),
});

export const updateBudgetSchema = createBudgetSchema;

export const updateBudgetStatusSchema = z.object({
  status: z.enum(['DRAFT', 'OPEN', 'SENT', 'NEGOTIATION', 'APPROVED', 'REJECTED', 'EXPIRED']),
  lossReason: optionalString,
  commercialNotes: optionalString,
});
