import { z } from 'zod';

const money = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  const num = Number(val);
  return Number.isNaN(num) ? undefined : num;
}, z.number());

const optionalUUID = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  z.string().uuid().optional(),
);

/** POST /client-credits/use — abate crédito do cliente (opcionalmente vinculado a um pedido) */
export const useCreditSchema = z.object({
  clientId: z.string().uuid('Cliente inválido'),
  amount: money.refine((v) => v > 0, 'O valor a utilizar deve ser maior que zero'),
  saleId: optionalUUID,
  note: z.string().max(500).optional(),
});

/** POST /client-credits/adjust — ajuste manual; `amount` com sinal (positivo credita, negativo debita) */
export const adjustCreditSchema = z.object({
  clientId: z.string().uuid('Cliente inválido'),
  amount: money.refine((v) => v !== 0, 'O valor do ajuste deve ser diferente de zero'),
  note: z.string().min(3, 'Descreva o motivo do ajuste').max(500),
});
