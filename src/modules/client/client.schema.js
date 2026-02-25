import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(255),
    
  type: z.enum(['PF', 'PJ', 'PE']),

  
  document: z.string()
    .min(11, "Documento inválido"),
  
  ie: z.string().max(20).optional(),
  
  indicatorIE: z.int().optional(),

  email: z.string()
    .email("Email inválido"),

  phone: z.string()
    .min(8, "Telefone inválido")
    .max(20),

  street: z.string().min(5),
  number: z.string().min(1, "Número inválido"),
  complement: z.string().optional(),
  neighborhood: z.string().min(2),
  city: z.string().min(2),
  state: z.string().length(2),
  zipCode: z.string().min(8),
  country: z.string().max(10)
}).strict();

export const updateClientSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(8).max(20).optional(),
  street: z.string().max(255).optional(),
  number: z.string().max(10).optional(),
  neighborhood: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zipCode: z.string().max(10).optional()
}).strict();