import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import prisma from '../src/database/prisma.js';
import { createWithSequence } from '../src/utils/createWithSequence.js';
import { normalizeCostCenterName } from '../src/utils/normalizeCostCenterName.js';

const DESIRED_CENTERS = ['Cerâmica', 'Caminhão', 'Carreta'];
export const CERAMICA_MARIM_CNPJ = '04034942000141';

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export async function runCeramicaMarimCostCenterSeed({
  client = prisma,
  targetCnpj = CERAMICA_MARIM_CNPJ,
  sequenceCreator = createWithSequence,
} = {}) {
  const normalizedTargetCnpj = digits(targetCnpj);
  if (normalizedTargetCnpj !== CERAMICA_MARIM_CNPJ) {
    throw new Error('Seed cancelado: o CNPJ informado não é o CNPJ validado da Cerâmica Marim.');
  }

  const companies = await client.company.findMany({
    where: { document: { not: null } },
    select: { id: true, cod: true, name: true, document: true },
  });
  const matches = companies.filter((company) => digits(company.document) === normalizedTargetCnpj);

  if (matches.length === 0) {
    throw new Error(`Cerâmica Marim não encontrada pelo CNPJ ${normalizedTargetCnpj}. Nenhuma empresa ou centro foi criado.`);
  }
  if (matches.length > 1) {
    throw new Error(`O CNPJ ${normalizedTargetCnpj} corresponde a ${matches.length} empresas. Seed cancelado por segurança.`);
  }

  const company = matches[0];
  const result = await client.$transaction(async (tx) => {
    const created = [];
    const existing = [];

    for (const name of DESIRED_CENTERS) {
      const normalizedName = normalizeCostCenterName(name);
      const found = await tx.costCenter.findFirst({
        where: { companyId: company.id, normalizedName },
        select: { id: true, name: true },
      });

      if (found) {
        existing.push(found.name);
        continue;
      }

      const costCenter = await sequenceCreator('costCenter', company.id, {
        name,
        normalizedName,
        status: 'ACTIVE',
      }, tx);
      created.push(costCenter.name);
    }

    return { created, existing };
  });

  return { company, ...result };
}

async function main() {
  const configuredCnpj = process.env.CERAMICA_MARIM_CNPJ || CERAMICA_MARIM_CNPJ;
  const result = await runCeramicaMarimCostCenterSeed({ targetCnpj: configuredCnpj });
  console.log(`Empresa localizada: ${result.company.name} (cod=${result.company.cod}, id=${result.company.id})`);
  console.log(`Centros criados: ${result.created.length ? result.created.join(', ') : 'nenhum'}`);
  console.log(`Centros já existentes e preservados: ${result.existing.length ? result.existing.join(', ') : 'nenhum'}`);
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main()
    .catch((error) => {
      console.error(`Seed cancelado: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
