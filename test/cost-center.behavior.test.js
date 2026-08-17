import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildCostCenterService } from '../src/modules/costCenters/costCenter.service.js';
import {
  CERAMICA_MARIM_CNPJ,
  runCeramicaMarimCostCenterSeed,
} from '../scripts/seed-ceramica-marim-cost-centers.js';
import { createSaleSchema } from '../src/modules/sales/sale.schema.js';
import { createBudgetSchema } from '../src/modules/budgets/budget.schema.js';
import { financeIntegrationService } from '../src/modules/financial/financeIntegration.service.js';

function createMemoryStore(initialCenters = []) {
  const centers = initialCenters.map((item) => ({ ...item }));
  let nextId = centers.length + 1;

  const matchesWhere = (center, where) => {
    if (where.id !== undefined && center.id !== where.id) return false;
    if (where.companyId !== undefined && center.companyId !== where.companyId) return false;
    if (where.status && where.status !== center.status) return false;
    if (where.normalizedName && where.normalizedName !== center.normalizedName) return false;
    if (where.OR) {
      const term = where.OR[0]?.name?.contains?.toLocaleLowerCase('pt-BR') || '';
      return center.name.toLocaleLowerCase('pt-BR').includes(term)
        || String(center.description || '').toLocaleLowerCase('pt-BR').includes(term);
    }
    return true;
  };

  const client = {
    costCenter: {
      findMany: async ({ where }) => centers.filter((center) => matchesWhere(center, where)),
      findFirst: async ({ where }) => centers.find((center) => matchesWhere(center, where)) || null,
      update: async ({ where, data }) => {
        const center = centers.find((item) => item.id === where.id);
        if (!center) throw new Error('not found');
        if (data.normalizedName && centers.some((item) => (
          item.id !== center.id
          && item.companyId === center.companyId
          && item.normalizedName === data.normalizedName
        ))) {
          const error = new Error('duplicate');
          error.code = 'P2002';
          throw error;
        }
        Object.assign(center, data);
        return { ...center };
      },
    },
    $transaction: async (callback) => callback(client),
  };

  const sequenceCreator = async (_model, companyId, data) => {
    if (centers.some((center) => center.companyId === companyId && center.normalizedName === data.normalizedName)) {
      const error = new Error('duplicate');
      error.code = 'P2002';
      throw error;
    }
    const created = {
      id: `center-${nextId++}`,
      cod: centers.filter((item) => item.companyId === companyId).length + 1,
      companyId,
      description: null,
      ...data,
    };
    centers.push(created);
    return { ...created };
  };

  return { centers, client, sequenceCreator };
}

test('cada empresa cadastra e visualiza somente os próprios centros', async () => {
  const memory = createMemoryStore();
  const service = buildCostCenterService(memory.client, memory.sequenceCreator);

  await service.create('company-a', { name: 'Cerâmica' });
  await service.create('company-b', { name: 'Cerâmica' });

  const companyA = await service.list('company-a', { status: 'ALL' });
  const companyB = await service.list('company-b', { status: 'ALL' });
  assert.equal(companyA.length, 1);
  assert.equal(companyB.length, 1);
  assert.equal(companyA[0].companyId, 'company-a');
  assert.equal(companyB[0].companyId, 'company-b');
});

test('mesma empresa não duplica nome normalizado', async () => {
  const memory = createMemoryStore();
  const service = buildCostCenterService(memory.client, memory.sequenceCreator);
  await service.create('company-a', { name: 'Cerâmica' });
  await assert.rejects(
    service.create('company-a', { name: '  CERAMICA  ' }),
    (error) => error.statusCode === 409,
  );
});

test('edição também respeita a unicidade do nome normalizado por empresa', async () => {
  const memory = createMemoryStore([
    { id: 'center-1', cod: 1, companyId: 'company-a', name: 'Cerâmica', normalizedName: 'ceramica', status: 'ACTIVE' },
    { id: 'center-2', cod: 2, companyId: 'company-a', name: 'Caminhão', normalizedName: 'caminhao', status: 'ACTIVE' },
  ]);
  const service = buildCostCenterService(memory.client, memory.sequenceCreator);
  await assert.rejects(
    service.update('company-a', 'center-2', { name: '  CERÂMICA ' }),
    (error) => error.statusCode === 409,
  );
});

test('ID adulterado não permite consultar, editar ou inativar centro de outro tenant', async () => {
  const memory = createMemoryStore([
    { id: 'center-b', cod: 1, companyId: 'company-b', name: 'Carreta', normalizedName: 'carreta', status: 'ACTIVE' },
  ]);
  const service = buildCostCenterService(memory.client, memory.sequenceCreator);

  await assert.rejects(service.getById('company-a', 'center-b'), (error) => error.statusCode === 404);
  await assert.rejects(service.update('company-a', 'center-b', { name: 'Invadido' }), (error) => error.statusCode === 404);
  await assert.rejects(service.updateStatus('company-a', 'center-b', 'INACTIVE'), (error) => error.statusCode === 404);
  assert.equal(memory.centers[0].status, 'ACTIVE');
  assert.equal(memory.centers[0].name, 'Carreta');
});

test('centro inativo permanece consultável no histórico', async () => {
  const memory = createMemoryStore([
    { id: 'center-a', cod: 1, companyId: 'company-a', name: 'Caminhão', normalizedName: 'caminhao', status: 'INACTIVE' },
  ]);
  const service = buildCostCenterService(memory.client, memory.sequenceCreator);
  assert.equal((await service.getById('company-a', 'center-a')).status, 'INACTIVE');
  assert.equal((await service.list('company-a', { status: 'ALL' })).length, 1);
  assert.equal((await service.list('company-a', { status: 'ACTIVE' })).length, 0);
});

test('contratos antigos de venda e orçamento continuam aceitando ausência de centro', () => {
  const base = {
    clientId: '11111111-1111-4111-8111-111111111111',
    statusId: '22222222-2222-4222-8222-222222222222',
    items: [{
      productId: '33333333-3333-4333-8333-333333333333',
      quantity: 1,
      unitPrice: 100,
    }],
  };
  assert.equal(createSaleSchema.safeParse(base).success, true);
  assert.equal(createSaleSchema.safeParse({ ...base, costCenterId: null }).success, true);

  const { statusId, ...budgetBase } = base;
  assert.equal(createBudgetSchema.safeParse(budgetBase).success, true);
  assert.equal(createBudgetSchema.safeParse({ ...budgetBase, costCenterId: null }).success, true);
});

test('herança do centro não altera valores nem classificação das parcelas', () => {
  const paymentMethods = new Map([['pm', {
    id: 'pm',
    name: 'Boleto',
    valueDestination: 'RECEIVABLE_ONLY',
    isImmediate: false,
  }]]);
  const input = {
    clientId: 'client-a',
    saleDate: '2026-08-17',
    salePaymentMethodId: 'pm',
    saleTotal: 125.5,
  };
  const withoutCenter = financeIntegrationService.planReceivablesFromSale(input, [], paymentMethods);
  const withCenter = financeIntegrationService.planReceivablesFromSale(
    { ...input, costCenterId: 'center-a' },
    [],
    paymentMethods,
  );
  assert.equal(withoutCenter.pending[0].amount, 125.5);
  assert.equal(withCenter.pending[0].amount, 125.5);
  assert.equal(withoutCenter.pending[0].costCenterId, null);
  assert.equal(withCenter.pending[0].costCenterId, 'center-a');
});

test('migration é aditiva, mantém colunas opcionais e cria FKs compostas de tenant', async () => {
  const sql = await readFile(new URL('../prisma/migrations/20260817160000_add_cost_centers/migration.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /^\s*(DROP|DELETE|TRUNCATE|UPDATE)\b/im);
  assert.match(sql, /ALTER TABLE "Sale" ADD COLUMN "costCenterId" TEXT;/);
  assert.match(sql, /FOREIGN KEY \("companyId", "costCenterId"\)/);
  assert.match(sql, /UNIQUE INDEX "CostCenter_companyId_normalizedName_key"/);
});

test('seed cria somente na Cerâmica por CNPJ, é idempotente e preserva outra empresa', async () => {
  const memory = createMemoryStore();
  memory.client.company = {
    findMany: async () => [
      { id: 'ceramica', cod: 4, name: 'Cerâmica Marim', document: '04.034.942/0001-41' },
      { id: 'other', cod: 5, name: 'Outra', document: '11.111.111/0001-11' },
    ],
  };

  const first = await runCeramicaMarimCostCenterSeed({
    client: memory.client,
    targetCnpj: CERAMICA_MARIM_CNPJ,
    sequenceCreator: memory.sequenceCreator,
  });
  const second = await runCeramicaMarimCostCenterSeed({
    client: memory.client,
    targetCnpj: CERAMICA_MARIM_CNPJ,
    sequenceCreator: memory.sequenceCreator,
  });

  assert.deepEqual(first.created, ['Cerâmica', 'Caminhão', 'Carreta']);
  assert.deepEqual(second.created, []);
  assert.deepEqual(second.existing, ['Cerâmica', 'Caminhão', 'Carreta']);
  assert.equal(memory.centers.filter((item) => item.companyId === 'ceramica').length, 3);
  assert.equal(memory.centers.filter((item) => item.companyId === 'other').length, 0);
});

test('seed não cria empresa quando o CNPJ confiável não é encontrado', async () => {
  const memory = createMemoryStore();
  memory.client.company = { findMany: async () => [] };
  await assert.rejects(
    runCeramicaMarimCostCenterSeed({
      client: memory.client,
      targetCnpj: CERAMICA_MARIM_CNPJ,
      sequenceCreator: memory.sequenceCreator,
    }),
    /Nenhuma empresa ou centro foi criado/,
  );
  assert.equal(memory.centers.length, 0);
});

test('seed recusa CNPJ diferente do identificador validado', async () => {
  const memory = createMemoryStore();
  memory.client.company = { findMany: async () => { throw new Error('consulta indevida'); } };
  await assert.rejects(
    runCeramicaMarimCostCenterSeed({
      client: memory.client,
      targetCnpj: '11111111000111',
      sequenceCreator: memory.sequenceCreator,
    }),
    /CNPJ informado não é o CNPJ validado/,
  );
  assert.equal(memory.centers.length, 0);
});

test('CRUD não expõe exclusão física de centro de custo', async () => {
  const routes = await readFile(new URL('../src/modules/costCenters/costCenter.routes.js', import.meta.url), 'utf8');
  assert.doesNotMatch(routes, /router\.delete\s*\(/);
  assert.match(routes, /patch\('\/:id\/status'/);
});

test('serviços de relatórios resolvem o filtro no tenant autenticado', async () => {
  const paths = [
    '../src/modules/financial/dreComparative.service.js',
    '../src/modules/reports/salesReport.service.js',
    '../src/modules/reports/productSalesReport.service.js',
    '../src/modules/reports/commercialSalesReport.service.js',
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /resolveCostCenterScope\s*\(\s*prisma\s*,\s*companyId\s*,/);
  }

  const saleController = await readFile(new URL('../src/modules/sales/sale.controller.js', import.meta.url), 'utf8');
  const budgetController = await readFile(new URL('../src/modules/budgets/budget.controller.js', import.meta.url), 'utf8');
  assert.match(saleController, /saleService\.list[\s\S]*costCenterScope/);
  assert.match(budgetController, /budgetService\.list[\s\S]*costCenterScope/);
});

test('frontend preserva o tenant no refresh e troca empresa por endpoint autenticado', async () => {
  const axiosSource = await readFile(new URL('../../erp_marim_frontend/src/lib/axios.ts', import.meta.url), 'utf8');
  const authSource = await readFile(new URL('../../erp_marim_frontend/src/services/auth.service.ts', import.meta.url), 'utf8');
  const selectorSource = await readFile(new URL('../../erp_marim_frontend/src/components/finance/CostCenterSelect.tsx', import.meta.url), 'utf8');
  assert.match(axiosSource, /companyId: useAuthStore\.getState\(\)\.user\?\.companyId/);
  assert.match(authSource, /auth\/switch-company/);
  assert.match(selectorSource, /costCenterService\.list\(\{ status: 'ALL' \}\)/);
});
