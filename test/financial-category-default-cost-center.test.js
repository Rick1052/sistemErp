import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { applyDefaultCostCenter } from '../src/modules/financial/financialRecord.service.js';

function categoryClient(category) {
  let receivedWhere = null;
  let calls = 0;
  return {
    client: {
      financialCategory: {
        findFirst: async ({ where }) => {
          calls += 1;
          receivedWhere = where;
          return category;
        },
      },
    },
    getCalls: () => calls,
    getReceivedWhere: () => receivedWhere,
  };
}

test('lançamento sem centro herda o padrão da conta dentro do tenant', async () => {
  const memory = categoryClient({ defaultCostCenterId: 'center-a' });
  const result = await applyDefaultCostCenter(memory.client, 'company-a', {
    categoryId: 'category-a',
    description: 'Energia elétrica',
  });

  assert.equal(result.costCenterId, 'center-a');
  assert.deepEqual(memory.getReceivedWhere(), { id: 'category-a', companyId: 'company-a' });
});

test('centro informado manualmente tem prioridade sobre o padrão da conta', async () => {
  const memory = categoryClient({ defaultCostCenterId: 'center-default' });
  const result = await applyDefaultCostCenter(memory.client, 'company-a', {
    categoryId: 'category-a',
    costCenterId: 'center-manual',
  });

  assert.equal(result.costCenterId, 'center-manual');
  assert.equal(memory.getCalls(), 0);
});

test('escolha explícita sem centro não é substituída pelo padrão da conta', async () => {
  const memory = categoryClient({ defaultCostCenterId: 'center-default' });
  const result = await applyDefaultCostCenter(memory.client, 'company-a', {
    categoryId: 'category-a',
    costCenterId: null,
  });

  assert.equal(result.costCenterId, null);
  assert.equal(memory.getCalls(), 0);
});

test('conta sem centro padrão mantém o lançamento sem centro', async () => {
  const memory = categoryClient({ defaultCostCenterId: null });
  const result = await applyDefaultCostCenter(memory.client, 'company-a', {
    categoryId: 'category-a',
  });

  assert.equal(result.costCenterId, null);
});

test('conta adulterada de outro tenant é rejeitada antes do lançamento', async () => {
  const memory = categoryClient(null);
  await assert.rejects(
    applyDefaultCostCenter(memory.client, 'company-a', { categoryId: 'category-b' }),
    (error) => error.statusCode === 400,
  );
  assert.deepEqual(memory.getReceivedWhere(), { id: 'category-b', companyId: 'company-a' });
});

test('migration do centro padrão é aditiva, opcional e protegida por empresa', async () => {
  const sql = await readFile(
    new URL('../prisma/migrations/20260817170000_add_default_cost_center_to_financial_category/migration.sql', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(sql, /^\s*(DROP|DELETE|TRUNCATE|UPDATE)\b/im);
  assert.match(sql, /ADD COLUMN "defaultCostCenterId" TEXT;/);
  assert.match(sql, /FOREIGN KEY \("companyId", "defaultCostCenterId"\)/);
  assert.match(sql, /REFERENCES "CostCenter"\("companyId", "id"\)/);
});

test('tela do plano de contas permite configurar e exibir o centro padrão', async () => {
  const source = await readFile(
    new URL('../../erp_marim_frontend/src/pages/FinancialCategories.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /name="defaultCostCenterId"/);
  assert.match(source, /category\.defaultCostCenter\.name/);
  assert.match(source, /Novos lançamentos desta conta herdam o centro/);
});
