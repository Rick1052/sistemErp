-- Centros de custo multiempresa (migration exclusivamente aditiva)

-- Sequência interna por empresa, seguindo o padrão dos demais cadastros.
ALTER TABLE "CompanySequence"
  ADD COLUMN "costCenterSeq" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CostCenter" (
  "id" TEXT NOT NULL,
  "cod" INTEGER NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "description" TEXT,
  "status" "Status" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CostCenter_normalizedName_not_blank" CHECK (length("normalizedName") > 0)
);

CREATE UNIQUE INDEX "CostCenter_companyId_cod_key"
  ON "CostCenter"("companyId", "cod");

CREATE UNIQUE INDEX "CostCenter_companyId_normalizedName_key"
  ON "CostCenter"("companyId", "normalizedName");

CREATE UNIQUE INDEX "CostCenter_companyId_id_key"
  ON "CostCenter"("companyId", "id");

CREATE INDEX "CostCenter_companyId_status_idx"
  ON "CostCenter"("companyId", "status");

ALTER TABLE "Sale" ADD COLUMN "costCenterId" TEXT;
ALTER TABLE "Budget" ADD COLUMN "costCenterId" TEXT;
ALTER TABLE "FinancialRecord" ADD COLUMN "costCenterId" TEXT;

CREATE INDEX "Sale_companyId_costCenterId_idx"
  ON "Sale"("companyId", "costCenterId");

CREATE INDEX "Budget_companyId_costCenterId_idx"
  ON "Budget"("companyId", "costCenterId");

CREATE INDEX "FinancialRecord_companyId_costCenterId_idx"
  ON "FinancialRecord"("companyId", "costCenterId");

ALTER TABLE "CostCenter"
  ADD CONSTRAINT "CostCenter_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- As FKs compostas impedem, também no banco, que um documento de uma empresa
-- aponte para um centro de custo pertencente a outra empresa.
ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_companyId_costCenterId_fkey"
  FOREIGN KEY ("companyId", "costCenterId")
  REFERENCES "CostCenter"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Budget"
  ADD CONSTRAINT "Budget_companyId_costCenterId_fkey"
  FOREIGN KEY ("companyId", "costCenterId")
  REFERENCES "CostCenter"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialRecord"
  ADD CONSTRAINT "FinancialRecord_companyId_costCenterId_fkey"
  FOREIGN KEY ("companyId", "costCenterId")
  REFERENCES "CostCenter"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
