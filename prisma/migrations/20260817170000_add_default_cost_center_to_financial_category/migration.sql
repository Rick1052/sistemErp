-- Centro de custo padrao opcional por conta do plano financeiro.
-- Migration exclusivamente aditiva; nenhum registro existente sofre alteracao.

ALTER TABLE "FinancialCategory"
  ADD COLUMN "defaultCostCenterId" TEXT;

CREATE INDEX "FinancialCategory_companyId_defaultCostCenterId_idx"
  ON "FinancialCategory"("companyId", "defaultCostCenterId");

-- A FK composta impede que uma conta use o centro de outra empresa.
ALTER TABLE "FinancialCategory"
  ADD CONSTRAINT "FinancialCategory_companyId_defaultCostCenterId_fkey"
  FOREIGN KEY ("companyId", "defaultCostCenterId")
  REFERENCES "CostCenter"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
