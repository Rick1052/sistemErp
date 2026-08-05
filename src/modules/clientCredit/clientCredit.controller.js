import { clientCreditService } from './clientCredit.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { cacheBumpVersion } from '../../utils/cache.js';

/** O saldo aparece na listagem de clientes: qualquer movimentação precisa invalidar aquele cache. */
async function bumpCreditCaches(companyId) {
  await cacheBumpVersion({ companyId, resource: 'clients' });
}

export const clientCreditController = {
  /** Regra 2 — saldo do cliente */
  balance: asyncHandler(async (req, res) => {
    const balance = await clientCreditService.consultarSaldoCliente(
      req.companyId,
      req.params.clientId,
    );
    res.json(balance);
  }),

  /** Regra 6 — histórico de movimentações */
  history: asyncHandler(async (req, res) => {
    const result = await clientCreditService.listarHistoricoCredito(req.companyId, req.query);
    res.json(result);
  }),

  /** Regras 4 e 5 — utilizar crédito (total ou parcial) fora do fluxo do pedido */
  use: asyncHandler(async (req, res) => {
    const { clientId, amount, saleId, note } = req.validatedBody;

    const movement = await clientCreditService.utilizarCredito({
      companyId: req.companyId,
      clientId,
      amount,
      saleId: saleId || null,
      userId: req.user.id,
      note: note || 'Utilização de crédito em conta',
    });

    await bumpCreditCaches(req.companyId);
    res.status(201).json({ message: 'Crédito utilizado com sucesso', movement });
  }),

  /** Ajuste manual (crédito ou débito) com motivo obrigatório */
  adjust: asyncHandler(async (req, res) => {
    const { clientId, amount, note } = req.validatedBody;

    const movement = await clientCreditService.ajustarCredito({
      companyId: req.companyId,
      clientId,
      amount,
      userId: req.user.id,
      note,
    });

    await bumpCreditCaches(req.companyId);
    res.status(201).json({ message: 'Ajuste de crédito registrado', movement });
  }),
};
