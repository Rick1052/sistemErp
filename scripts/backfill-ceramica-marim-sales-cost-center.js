import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import prisma from '../src/database/prisma.js';
import { CERAMICA_MARIM_CNPJ } from './seed-ceramica-marim-cost-centers.js';

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export async function runCeramicaMarimSalesCostCenterBackfill({
  client = prisma,
  targetCnpj = CERAMICA_MARIM_CNPJ,
  dryRun = true,
} = {}) {
  const normalizedTargetCnpj = digits(targetCnpj);
  if (normalizedTargetCnpj !== CERAMICA_MARIM_CNPJ) {
    throw new Error('Backfill cancelado: o CNPJ informado não é o CNPJ validado da Cerâmica Marim.');
  }

  const companies = await client.company.findMany({
    where: { document: { not: null } },
    select: { id: true, cod: true, name: true, document: true },
  });
  const matches = companies.filter((company) => digits(company.document) === normalizedTargetCnpj);
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `Backfill cancelado: empresa com CNPJ ${normalizedTargetCnpj} não encontrada.`
        : `Backfill cancelado: o CNPJ ${normalizedTargetCnpj} corresponde a ${matches.length} empresas.`,
    );
  }

  const company = matches[0];
  const result = await client.$transaction(async (tx) => {
    const center = await tx.costCenter.findFirst({
      where: { companyId: company.id, normalizedName: 'ceramica', status: 'ACTIVE' },
      select: { id: true, cod: true, name: true },
    });
    if (!center) {
      throw new Error('Backfill cancelado: centro ativo "Cerâmica" não encontrado. Execute o seed primeiro.');
    }

    const [totalSales, alreadyAssigned] = await Promise.all([
      tx.sale.count({ where: { companyId: company.id } }),
      tx.sale.count({ where: { companyId: company.id, costCenterId: center.id } }),
    ]);
    const pending = totalSales - alreadyAssigned;

    if (dryRun) {
      return { center, totalSales, alreadyAssigned, pending, updated: 0, verified: alreadyAssigned };
    }

    const updateResult = await tx.sale.updateMany({
      where: {
        companyId: company.id,
        // Em SQL, `NOT (costCenterId = id)` não inclui NULL. O ramo explícito
        // garante que vendas antigas sem classificação também sejam atualizadas.
        OR: [
          { costCenterId: null },
          { costCenterId: { not: center.id } },
        ],
      },
      data: { costCenterId: center.id },
    });
    const verified = await tx.sale.count({
      where: { companyId: company.id, costCenterId: center.id },
    });
    if (verified !== totalSales || updateResult.count !== pending) {
      throw new Error(
        `Backfill revertido: esperado=${totalSales}, atualizado=${updateResult.count}, verificado=${verified}.`,
      );
    }

    return {
      center,
      totalSales,
      alreadyAssigned,
      pending,
      updated: updateResult.count,
      verified,
    };
  });

  return { company, dryRun, ...result };
}

async function main() {
  const wantsApply = process.argv.includes('--apply');
  const wantsDryRun = process.argv.includes('--dry-run');
  if (wantsApply && wantsDryRun) {
    throw new Error('Escolha somente --dry-run ou --apply.');
  }

  const dryRun = !wantsApply;
  const configuredCnpj = process.env.CERAMICA_MARIM_CNPJ || CERAMICA_MARIM_CNPJ;
  const result = await runCeramicaMarimSalesCostCenterBackfill({
    targetCnpj: configuredCnpj,
    dryRun,
  });

  console.log(`Modo: ${result.dryRun ? 'simulação sem escrita' : 'aplicação'}`);
  console.log(`Empresa: ${result.company.name} (cod=${result.company.cod}, id=${result.company.id})`);
  console.log(`Centro: ${result.center.name} (cod=${result.center.cod}, id=${result.center.id})`);
  console.log(`Vendas totais: ${result.totalSales}`);
  console.log(`Já classificadas: ${result.alreadyAssigned}`);
  console.log(`Pendentes: ${result.pending}`);
  console.log(`Atualizadas: ${result.updated}`);
  if (dryRun) console.log('Nenhum registro foi alterado. Use --apply após conferir os números.');
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
