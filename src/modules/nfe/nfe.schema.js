import { z } from 'zod';

export const configureCompanySchema = z.object({
  ie: z.string().min(1).optional(),
  regimeTributario: z.coerce.number().int().min(1).max(4).optional(),
  cnae: z.string().optional(),
  certificadoBase64: z.string().optional(),
  senhaCertificado: z.string().optional(),
});

export const setAmbienteSchema = z.object({
  ambiente: z.enum(['homologacao', 'producao']),
});

export const cancelNfeSchema = z.object({
  justificativa: z.string().min(15).max(255),
});
