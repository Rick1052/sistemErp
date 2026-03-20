import prisma from './src/database/prisma.js';
import { saleService } from './src/modules/sales/sale.service.js';
import assert from 'node:assert';

async function runTests() {
  const statusOpen = await prisma.saleStatus.findFirst({ where: { stockAction: 'NONE' } });
  const companyId = statusOpen.companyId;

  const company = await prisma.company.findUnique({ where: { id: companyId }});
  const userComp = await prisma.userCompany.findFirst({ where: { companyId }});
  const user = await prisma.user.findUnique({ where: { id: userComp.userId }});
  const client = await prisma.client.findFirst({ where: { companyId } });
  const product = await prisma.product.findFirst({ where: { companyId } });
  
  const statusCommit = await prisma.saleStatus.findFirst({ where: { stockAction: 'COMMIT', companyId } });


  console.log(`Company: ${company.id}, User: ${user.id}`);
  console.log(`Status OPEN: ${statusOpen.name}, Status COMMIT: ${statusCommit.name}`);

  // Helpers
  const createPayload = (statusId) => ({
    clientId: client.id,
    statusId: statusId,
    discount: 0,
    freight: 0,
    items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
    installments: [{ amount: 100, dueDate: new Date() }]
  });

  console.log('\n--- CENÁRIO 1: Criar e Excluir Pedido em Aberto ---');
  const sale1 = await saleService.create(company.id, user.id, createPayload(statusOpen.id));
  console.log('Venda 1 criada:', sale1.id, sale1.status.name);
  try {
    await saleService.delete(company.id, user.id, sale1.id);
    console.log('✅ Venda 1 excluída com sucesso (Esperado).');
  } catch (e) {
    console.error('❌ Erro inesperado ao excluir Venda 1:', e.message);
  }

  console.log('\n--- CENÁRIO 2: Criar Pedido COMMIT e tentar excluir ---');
  // Re-fetch product to get current stock
  const pBeforeCommit = await prisma.product.findUnique({ where: { id: product.id } });
  const sale2 = await saleService.create(company.id, user.id, createPayload(statusCommit.id));
  console.log('Venda 2 criada:', sale2.id, sale2.status.name);
  
  try {
    await saleService.delete(company.id, user.id, sale2.id);
    console.error('❌ Venda 2 foi excluída, mas deveria ter sido bloqueada!');
  } catch (e) {
    console.log('✅ Exclusão bloqueada com sucesso:', e.message);
  }

  console.log('\n--- CENÁRIO 3: Mudar status para COMMIT (já está) -> OPEN (com parcela paga) ---');
  // Mark record as PAID
  const records = await prisma.financialRecord.findMany({ where: { saleId: sale2.id } });
  if (records.length > 0) {
    await prisma.financialRecord.update({ where: { id: records[0].id }, data: { status: 'PAID' } });
    console.log(`Financeiro ${records[0].id} marcado como PAID.`);
    
    try {
      await saleService.updateStatus(company.id, user.id, sale2.id, statusOpen.id);
      console.error('❌ Status alterado, mas deveria ter sido bloqueado por ter financeiro pago!');
    } catch (e) {
      console.log('✅ Bloqueio de estorno com financeiro PAID funcionou:', e.message);
    }
    
    // Revert to PENDING
    await prisma.financialRecord.update({ where: { id: records[0].id }, data: { status: 'PENDING' } });
    console.log(`Financeiro revertido para PENDING.`);
  }

  console.log('\n--- CENÁRIO 4: Estornar Pedido COMMIT -> OPEN (PENDING refs excluidas, estoque devolvido) ---');
  try {
    await saleService.updateStatus(company.id, user.id, sale2.id, statusOpen.id);
    console.log('✅ Pedido estornado para OPEN com sucesso.');
    
    // Check finance is deleted
    const countFin = await prisma.financialRecord.count({ where: { saleId: sale2.id } });
    console.log(`Registros financeiros após estorno: ${countFin} (Esperado: 0)`);
    
    // Check stock returned
    const pAfterRollback = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`Estoque ANTES (antes do COMMIT): ${pBeforeCommit.physicalStock}`);
    console.log(`Estoque AGORA (após COMMIT e ROLLBACK): ${pAfterRollback.physicalStock}`);
    assert.strictEqual(pBeforeCommit.physicalStock, pAfterRollback.physicalStock, 'O estoque não foi devolvido adequadamente!');
    
    console.log('\n--- CENÁRIO 5: Excluir o Pedido pós-estorno ---');
    await saleService.delete(company.id, user.id, sale2.id);
    console.log('✅ Exclusão pós-estorno realizada com sucesso!');
    
  } catch (e) {
    console.error('❌ Falha no estorno:', e);
  }
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
