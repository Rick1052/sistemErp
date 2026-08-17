import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCostCenterBelongsToCompany,
  resolveCostCenterScope,
} from '../src/modules/costCenters/costCenter.service.js';
import { normalizeCostCenterName } from '../src/utils/normalizeCostCenterName.js';

test('normaliza acentos, caixa e espaços para a chave única por empresa', () => {
  assert.equal(normalizeCostCenterName('  Cerâmica   Marim  '), 'ceramica marim');
  assert.equal(normalizeCostCenterName('CAMINHÃO'), 'caminhao');
});

test('resolve todos os escopos especiais sem consultar outro tenant', async () => {
  const client = {
    costCenter: {
      findFirst: async () => {
        throw new Error('consulta inesperada');
      },
    },
  };

  assert.deepEqual(await resolveCostCenterScope(client, 'company-a', undefined), {});
  assert.deepEqual(await resolveCostCenterScope(client, 'company-a', 'all'), {});
  assert.deepEqual(await resolveCostCenterScope(client, 'company-a', 'assigned'), {
    costCenterId: { not: null },
  });
  assert.deepEqual(await resolveCostCenterScope(client, 'company-a', 'unassigned'), {
    costCenterId: null,
  });
});

test('valida um centro específico usando id e companyId juntos', async () => {
  let receivedWhere;
  const client = {
    costCenter: {
      findFirst: async ({ where }) => {
        receivedWhere = where;
        return { id: 'center-a', companyId: 'company-a', status: 'ACTIVE' };
      },
    },
  };

  assert.deepEqual(await resolveCostCenterScope(client, 'company-a', 'center-a'), {
    costCenterId: 'center-a',
  });
  assert.deepEqual(receivedWhere, { id: 'center-a', companyId: 'company-a' });
});

test('rejeita centro inexistente no tenant e centro inativo para novo vínculo', async () => {
  const crossTenantClient = {
    costCenter: { findFirst: async () => null },
  };
  await assert.rejects(
    resolveCostCenterScope(crossTenantClient, 'company-a', 'center-from-company-b'),
    (error) => error.statusCode === 400,
  );

  const inactiveClient = {
    costCenter: {
      findFirst: async () => ({ id: 'center-a', companyId: 'company-a', status: 'INACTIVE' }),
    },
  };
  await assert.rejects(
    assertCostCenterBelongsToCompany(inactiveClient, 'company-a', 'center-a', { requireActive: true }),
    (error) => error.statusCode === 400,
  );
});
