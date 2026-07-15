import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  companyId: z.string().uuid(),
  cpfCnpj: z.string().min(11).max(20).optional(),
  value: z.coerce.number().positive('O valor deve ser maior que zero'),
  dueDay: z.coerce.number().int().min(1).max(28),
  description: z.string().min(1).max(255),
  billingType: z.enum(['UNDEFINED', 'PIX', 'BOLETO', 'CREDIT_CARD']).optional(),
});
