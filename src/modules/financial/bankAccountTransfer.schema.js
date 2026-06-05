import { z } from 'zod';

export const bankAccountTransferSchema = z.object({
  fromBankAccountId: z.string().uuid('Conta de origem inválida'),
  toBankAccountId: z.string().uuid('Conta de destino inválida'),
  amount: z.coerce.number().positive('Informe um valor maior que zero'),
  note: z.string().max(500).optional(),
});
