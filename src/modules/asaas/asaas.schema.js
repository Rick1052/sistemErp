import { z } from 'zod';

export const configureSchema = z.object({
  environment: z.enum(['SANDBOX', 'PRODUCTION']),
  apiKey: z.string().min(10, 'API key inválida'),
});

export const setEnvironmentSchema = z.object({
  environment: z.enum(['SANDBOX', 'PRODUCTION']),
});

export const createSubscriptionSchema = z.object({
  clientId: z.string().uuid(),
  value: z.coerce.number().positive('O valor deve ser maior que zero'),
  dueDay: z.coerce.number().int().min(1).max(28),
  description: z.string().min(1).max(255),
  billingType: z.enum(['UNDEFINED', 'PIX', 'BOLETO', 'CREDIT_CARD']).optional(),
});
