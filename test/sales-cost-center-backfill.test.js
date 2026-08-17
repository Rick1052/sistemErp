import assert from 'node:assert/strict';
import test from 'node:test';
import { CERAMICA_MARIM_CNPJ } from '../scripts/seed-ceramica-marim-cost-centers.js';
import { runCeramicaMarimSalesCostCenterBackfill } from '../scripts/backfill-ceramica-marim-sales-cost-center.js';

function createMemoryClient() {
  const sales = [
    { id: 'sale-1', companyId: 'ceramica', costCenterId: null },
    { id: 'sale-2', companyId: 'ceramica', costCenterId: 'other-center' },
    { id: 'sale-3', companyId: 'other-company', costCenterId: null },
  ];

  const matches = (sale, where) => {
    if (where.companyId && sale.companyId !== where.companyId) return false;
    if (where.OR && !where.OR.some((part) => matches(sale, part))) return false;
    if (where.costCenterId !== undefined) {
      if (where.costCenterId && typeof where.costCenterId === 'object') {
        if (where.costCenterId.not !== undefined && sale.costCenterId === where.costCenterId.not) return false;
        // Espelha o comportamento SQL: `NULL <> valor` não é verdadeiro.
        if (where.costCenterId.not !== undefined && sale.costCenterId === null) return false;
      } else if (sale.costCenterId !== where.costCenterId) {
        return false;
      }
    }
    return true;
  };

  const client = {
    company: {
      findMany: async () => [
        { id: 'ceramica', cod: 4, name: 'Cerâmica Marim', document: '04.034.942/0001-41' },
        { id: 'other-company', cod: 5, name: 'Outra', document: '11.111.111/0001-11' },
      ],
    },
    costCenter: {
      findFirst: async ({ where }) => (
        where.companyId === 'ceramica' && where.normalizedName === 'ceramica' && where.status === 'ACTIVE'
          ? { id: 'center-ceramica', cod: 1, name: 'Cerâmica' }
          : null
      ),
    },
    sale: {
      count: async ({ where }) => sales.filter((sale) => matches(sale, where)).length,
      updateMany: async ({ where, data }) => {
        let count = 0;
        sales.forEach((sale) => {
          if (matches(sale, where)) {
            Object.assign(sale, data);
            count += 1;
          }
        });
        return { count };
      },
    },
  };
  client.$transaction = async (callback) => callback(client);
  return { client, sales };
}

test('simulação informa o impacto e não altera vendas', async () => {
  const memory = createMemoryClient();
  const result = await runCeramicaMarimSalesCostCenterBackfill({
    client: memory.client,
    targetCnpj: CERAMICA_MARIM_CNPJ,
    dryRun: true,
  });

  assert.equal(result.totalSales, 2);
  assert.equal(result.pending, 2);
  assert.equal(result.updated, 0);
  assert.equal(memory.sales[0].costCenterId, null);
  assert.equal(memory.sales[2].costCenterId, null);
});

test('aplicação classifica todas as vendas da Cerâmica e preserva outra empresa', async () => {
  const memory = createMemoryClient();
  const first = await runCeramicaMarimSalesCostCenterBackfill({
    client: memory.client,
    targetCnpj: CERAMICA_MARIM_CNPJ,
    dryRun: false,
  });
  const second = await runCeramicaMarimSalesCostCenterBackfill({
    client: memory.client,
    targetCnpj: CERAMICA_MARIM_CNPJ,
    dryRun: false,
  });

  assert.equal(first.updated, 2);
  assert.equal(first.verified, 2);
  assert.equal(second.updated, 0);
  assert.equal(second.verified, 2);
  assert.equal(memory.sales[2].costCenterId, null);
});

test('backfill recusa CNPJ diferente do alvo validado', async () => {
  const memory = createMemoryClient();
  await assert.rejects(
    runCeramicaMarimSalesCostCenterBackfill({
      client: memory.client,
      targetCnpj: '11111111000111',
      dryRun: false,
    }),
    /CNPJ informado não é o CNPJ validado/,
  );
  assert.equal(memory.sales[0].costCenterId, null);
});
