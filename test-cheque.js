import prisma from './src/database/prisma.js';
import { financialRecordController } from './src/modules/financial/financialRecord.controller.js';
import { financialRecordService } from './src/modules/financial/financialRecord.service.js';

async function runTests() {
  console.log('--- Iniciando Testes de Cheque ---');

  // 1. Pegar um companyId válido
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('Nenhuma empresa encontrada no banco para testar.');
    process.exit(1);
  }
  const companyId = company.id;
  console.log(`Usando Empresa ID: ${companyId}`);

  // Pegar uma conta bancaria para não quebrar validações do service (se houver)
  const bankAccount = await prisma.bankAccount.findFirst({ where: { companyId } });

  // 2. Mock de Req/Res via Promise
  const executeController = (controllerMethod, req) => {
    return new Promise((resolve) => {
      const res = {};
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.data = data;
        resolve({ res, err: null });
        return res;
      };
      res.send = () => { resolve({ res, err: null }); return res; };
      
      controllerMethod(req, res, (err) => {
        resolve({ res, err });
      });
    });
  };

  // TESTE 1: Falha na validação (Enviando chequeNumber sem chequeOwner/dueDate)
  console.log('\n>>> Teste 1: Bloquear cheque incompleto');
  const req1 = {
    companyId,
    body: {
      type: 'RECEIVABLE',
      description: 'Teste Cheque Incompleto',
      amount: 100,
      dueDate: new Date().toISOString(),
      date: new Date().toISOString(),
      chequeNumber: 'CHQ-12345'
      // Faltando chequeOwner e chequeDueDate
    }
  };
  
  const result1 = await executeController(financialRecordController.create, req1);
  const res1 = result1.res;
  
  if (res1.statusCode === 400 && res1.data?.error?.includes('obrigatório informar o titular')) {
    console.log('✅ SUCESSO: A API bloqueou corretamente o cheque incompleto.');
  } else {
    console.error('❌ FALHA: A API NÃO bloqueou o cheque incompleto.', res1.statusCode, res1.data, result1.err);
  }

  // TESTE 2: Sucesso na criação do cheque
  console.log('\n>>> Teste 2: Salvar cheque completo com sucesso');
  const req2 = {
    companyId,
    body: {
      type: 'RECEIVABLE',
      description: 'Teste Cheque Completo',
      amount: 250.50,
      dueDate: new Date().toISOString(),
      date: new Date().toISOString(),
      chequeNumber: 'CHQ-98765',
      chequeOwner: 'João da Silva',
      chequeDueDate: new Date(Date.now() + 86400000 * 5).toISOString(), // Bom para daqui a 5 dias
      bankAccountId: bankAccount?.id
    }
  };

  const result2 = await executeController(financialRecordController.create, req2);
  const res2 = result2.res;
  
  if (result2.err) {
    console.error('ERRO NO SERVICE (TEST 2):', result2.err);
  }

  let createdRecordId = null;
  if (res2.statusCode === 201 && res2.data?.chequeNumber === 'CHQ-98765') {
    createdRecordId = res2.data.id;
    console.log('✅ SUCESSO: Cheque inserido corretamente no banco de dados!');
    console.log('   Dados Salvos:');
    console.log(`   - ID: ${res2.data.id}`);
    console.log(`   - Cheque #: ${res2.data.chequeNumber}`);
    console.log(`   - Titular: ${res2.data.chequeOwner}`);
    console.log(`   - Bom Para: ${res2.data.chequeDueDate}`);
  } else {
    console.error('❌ FALHA: A API falhou ao inserir o cheque.', res2.statusCode, res2.data);
  }

  // TESTE 3: Limpar teste (Deletar o registro)
  if (createdRecordId) {
    console.log('\n>>> Limpando ambiente...');
    await prisma.financialRecord.delete({ where: { id: createdRecordId } });
    console.log('✅ Registro de teste deletado com sucesso.');
  }

  console.log('\n--- Testes Finalizados ---');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
