import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome precisa ter mais que 2 caracteres")
    .max(55, "O nome pode ter no máximo 55 caracteres"),

  document: z
    .string()
    .trim()
    .min(8, "Documento inválido"),

  email: z
    .string()
    .trim()
    .email("Formato de email inválido"),
    
  phone: z
    .string()
    .trim()
    .min(8, "Telefone deve ter no mínimo 8 dígitos")
    .max(15, "Telefone muito longo"), // Aumentei para 15 para aceitar formatos internacionais ou com DDD

}).strict();

// Schema de Update (caso você queira permitir atualizar apenas alguns campos)
export const updateSupplierSchema = createSupplierSchema.partial();