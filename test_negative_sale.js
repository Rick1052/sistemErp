import prisma from './src/database/prisma.js';
import { saleService } from './src/modules/sales/sale.service.js';
import logger from './src/utils/logger.js';

async function verifyNegativeSale() {
  console.log('>>> Iniciando Verificação de Venda com Desconto Negativo e Total Negativo\n');

  // 1. Setup metadata
  const statusOpen = await prisma.saleStatus.findFirst({ where: { stockAction: 'NONE' } });
  if (!statusOpen) {
    console.error('ERRO: Não encontrei status com stockAction NONE. Execute os seeds primeiro.');
    return;
  }
  const statusCommit = await prisma.saleStatus.findFirst({ where: { stockAction: 'COMMIT', companyId: statusOpen.companyId } });
  const companyId = statusOpen.companyId;
  const userComp = await prisma.userCompany.findFirst({ where: { companyId } });
  const userId = userComp.userId;
  const client = await prisma.client.findFirst({ where: { companyId } });
  const product = await prisma.product.findFirst({ where: { companyId } });
  const paymentMethod = await prisma.paymentMethod.findFirst({ where: { companyId } });

  if (!client || !product || !paymentMethod) {
    console.error('ERRO: Dados insuficientes (cliente, produto ou método de pagamento) para o teste.');
    return;
  }

  console.log(`Ambiente OK. Empresa: ${companyId}, Cliente: ${client.name}, Produto: ${product.description}`);

  // 2. Teste: Criar venda com desconto negativo (acréscimo)
  console.log('\n--- CENÁRIO 1: Desconto Negativo (Acréscimo no total) ---');
  try {
    const payload1 = {
      clientId: client.id,
      statusId: statusOpen.id,
      date: new Date(),
      paymentMethodId: paymentMethod.id,
      discount: -50, // R$ 50,00 de acréscimo
      freight: 10,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      installments: [{ paymentMethodId: paymentMethod.id, amount: 160, dueDate: new Date() }] // 100 - (-50) + 10 = 160
    };

    const sale1 = await saleService.create(companyId, userId, payload1);
    console.log(`✅ Sucesso! Venda #${sale1.cod} criada com desconto negativo.`);
    console.log(`   Subtotal: ${sale1.subtotal}, Desconto: ${sale1.discount}, Total: ${sale1.total}`);
    
    if (Number(sale1.total) === 160) {
        console.log('   ✅ Total calculado corretamente (100 + 50 + 10 = 160).');
    } else {
        console.error(`   ❌ Total incorreto: ${sale1.total}. Esperado 160.`);
    }
  } catch (error) {
    console.error('❌ Falha no Cenário 1:', error.message);
  }

  // 3. Teste: Criar venda com total negativo (grande desconto)
  console.log('\n--- CENÁRIO 2: Total Negativo (Desconto > Subtotal) ---');
  try {
    const payload2 = {
      clientId: client.id,
      statusId: statusCommit.id, // COMMIT para testar integração financeira
      date: new Date(),
      paymentMethodId: paymentMethod.id,
      discount: 150, // R$ 150,00 de desconto
      freight: 10,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      installments: [{ paymentMethodId: paymentMethod.id, amount: -40, dueDate: new Date() }] // 100 - 150 + 10 = -40
    };

    const sale2 = await saleService.create(companyId, userId, payload2);
    console.log(`✅ Sucesso! Venda #${sale2.cod} (COMMIT) criada com total negativo.`);
    console.log(`   Subtotal: ${sale2.subtotal}, Desconto: ${sale2.discount}, Total: ${sale2.total}`);

    // Verificar se o financeiro foi criado mesmo com valor negativo
    const records = await prisma.financialRecord.findMany({ where: { saleId: sale2.id } });
    console.log(`   Registros financeiros gerados: ${records.length}`);
    if (records.length > 0) {
        console.log(`   ✅ Registro #1 Valor: ${records[0].amount}`);
        if (Number(records[0].amount) === -40) {
            console.log('   ✅ Valor do registro financeiro está correto (-40).');
        } else {
            console.error(`   ❌ Valor financeiro incorreto: ${records[0].amount}. Esperado -40.`);
        }
    } else {
        console.error('   ❌ Nenhum registro financeiro foi criado para a venda COMMIT com valor negativo.');
    }
  } catch (error) {
    console.error('❌ Falha no Cenário 2:', error.message);
    if (error.errors) console.error('Erros de validação:', JSON.stringify(error.errors, null, 2));
  }

  console.log('\n>>> Fim da verificação');
}

verifyNegativeSale()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
