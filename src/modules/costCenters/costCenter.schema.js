import { z } from 'zod';

const nullableDescription = z
  .union([z.string().trim().max(500, 'A descrição deve ter no máximo 500 caracteres'), z.null()])
  .optional();

export const createCostCenterSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(120, 'O nome deve ter no máximo 120 caracteres'),
  description: nullableDescription,
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict();

export const updateCostCenterSchema = createCostCenterSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar');

export const updateCostCenterStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
}).strict();

