import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';

export const reportService = {
  async getDRE(companyId, startDate, endDate) {
    // 1. Busque TODAS as categorias financeiras do banco
    const categories = await prisma.financialCategory.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { cod: 'asc' },
    });

    // 2. Busque TODOS os FinancialRecord pagos dentro do período solicitado
    const records = await prisma.financialRecord.findMany({
      where: {
        companyId,
        status: 'PAID',
        paymentDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        category: true,
      },
    });

    // 3. Crie um mapa/dicionário em memória com o total de cada categoria do banco
    // Inicializamos todos com 0
    const categoryTotals = {};
    categories.forEach((cat) => {
      categoryTotals[cat.id] = 0;
    });

    // Somamos os valores nas categorias correspondentes
    records.forEach((record) => {
      if (record.categoryId && categoryTotals[record.categoryId] !== undefined) {
        const amount = Number(record.amount);
        
        // Se for Receita, RECEIVABLE soma e PAYABLE (ajuste) subtrai
        // Se for Despesa, PAYABLE soma e RECEIVABLE (reembolso) subtrai
        const category = categories.find(c => c.id === record.categoryId);
        if (category.type === 'REVENUE') {
          if (record.type === 'RECEIVABLE') {
            categoryTotals[record.categoryId] += amount;
          } else {
            categoryTotals[record.categoryId] -= amount;
          }
        } else if (category.type === 'EXPENSE') {
          if (record.type === 'PAYABLE') {
            categoryTotals[record.categoryId] += amount;
          } else {
            categoryTotals[record.categoryId] -= amount;
          }
        }
      }
    });

    // 4. Lógica de Agregação (Bottom-Up)
    const categoryMap = {};
    categories.forEach((cat) => {
      categoryMap[cat.id] = {
        ...cat,
        total: categoryTotals[cat.id] || 0,
        children: [],
      };
    });

    const tree = [];
    categories.forEach((cat) => {
      if (cat.parentId && categoryMap[cat.parentId]) {
        categoryMap[cat.parentId].children.push(categoryMap[cat.id]);
      } else if (!cat.parentId) {
        tree.push(categoryMap[cat.id]);
      }
    });

    // Função recursiva para somar os totais dos filhos nos pais
    function aggregateTotals(node) {
      if (!node.children || node.children.length === 0) {
        return node.total;
      }

      let childrenTotal = 0;
      node.children.forEach((child) => {
        childrenTotal += aggregateTotals(child);
      });

      node.total += childrenTotal;
      return node.total;
    }

    tree.forEach((rootNode) => {
      aggregateTotals(rootNode);
    });

    // 5. Calcule as linhas macro do DRE
    const revenueRoots = tree.filter(cat => cat.type === 'REVENUE');
    const expenseRoots = tree.filter(cat => cat.type === 'EXPENSE');

    // Tentativa de identificar Deduções (ex: categorias raízes com nome 'Deduções' ou similares)
    const deductionsRoots = revenueRoots.filter(cat => 
      cat.name.toLowerCase().includes('dedução') || 
      cat.name.toLowerCase().includes('deduções') ||
      cat.name.toLowerCase().includes('impostos sobre vendas')
    );
    
    // Receita Bruta = Soma de todas as raízes de receita
    const grossRevenue = revenueRoots.reduce((acc, cat) => acc + cat.total, 0);
    const deductionsTotal = deductionsRoots.reduce((acc, cat) => acc + cat.total, 0);
    const netRevenue = grossRevenue - deductionsTotal;
    const operatingCosts = expenseRoots.reduce((acc, cat) => acc + cat.total, 0);
    const netProfit = netRevenue - operatingCosts;

    return {
      summary: {
        grossRevenue,
        deductions: deductionsTotal,
        netRevenue,
        operatingCosts,
        netProfit,
      },
      tree,
    };
  },
};
