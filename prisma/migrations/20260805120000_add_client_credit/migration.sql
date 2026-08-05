-- Crédito em conta do cliente (saldo em haver)
-- - Enum ClientCreditType
-- - Client.creditBalance (espelho do saldo, mantido dentro da mesma transação do razão)
-- - Sale.creditUsed (parte do pedido abatida com crédito)
-- - FinancialRecordPayment.creditGenerated (excedente da baixa que virou crédito)
-- - Tabela ClientCredit (razão/extrato das movimentações)
-- - CompanySequence.clientCreditSeq

-- 1) Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientCreditType') THEN
    CREATE TYPE "ClientCreditType" AS ENUM ('CREDIT', 'USAGE', 'ADJUSTMENT');
  END IF;
END
$$;

-- 2) Colunas novas
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "creditBalance" DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "creditUsed" DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE "FinancialRecordPayment"
  ADD COLUMN IF NOT EXISTS "creditGenerated" DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE "CompanySequence"
  ADD COLUMN IF NOT EXISTS "clientCreditSeq" INTEGER NOT NULL DEFAULT 0;

-- 3) Razão de crédito
CREATE TABLE IF NOT EXISTS "ClientCredit" (
  "id" TEXT NOT NULL,
  "cod" INTEGER NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "saleId" TEXT,
  "financialRecordId" TEXT,
  "financialRecordPaymentId" TEXT,
  "type" "ClientCreditType" NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "previousBalance" DECIMAL(15,2) NOT NULL,
  "newBalance" DECIMAL(15,2) NOT NULL,
  "note" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientCredit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientCredit_companyId_cod_key" ON "ClientCredit"("companyId", "cod");
CREATE INDEX IF NOT EXISTS "ClientCredit_companyId_idx" ON "ClientCredit"("companyId");
CREATE INDEX IF NOT EXISTS "ClientCredit_clientId_idx" ON "ClientCredit"("clientId");
CREATE INDEX IF NOT EXISTS "ClientCredit_saleId_idx" ON "ClientCredit"("saleId");
CREATE INDEX IF NOT EXISTS "ClientCredit_companyId_clientId_createdAt_idx" ON "ClientCredit"("companyId", "clientId", "createdAt");

-- Postgres não tem ADD CONSTRAINT IF NOT EXISTS: dropamos antes para o script
-- poder ser reaplicado sem erro.
ALTER TABLE "ClientCredit" DROP CONSTRAINT IF EXISTS "ClientCredit_companyId_fkey";
ALTER TABLE "ClientCredit"
  ADD CONSTRAINT "ClientCredit_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientCredit" DROP CONSTRAINT IF EXISTS "ClientCredit_clientId_fkey";
ALTER TABLE "ClientCredit"
  ADD CONSTRAINT "ClientCredit_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientCredit" DROP CONSTRAINT IF EXISTS "ClientCredit_saleId_fkey";
ALTER TABLE "ClientCredit"
  ADD CONSTRAINT "ClientCredit_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientCredit" DROP CONSTRAINT IF EXISTS "ClientCredit_financialRecordId_fkey";
ALTER TABLE "ClientCredit"
  ADD CONSTRAINT "ClientCredit_financialRecordId_fkey"
  FOREIGN KEY ("financialRecordId") REFERENCES "FinancialRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientCredit" DROP CONSTRAINT IF EXISTS "ClientCredit_financialRecordPaymentId_fkey";
ALTER TABLE "ClientCredit"
  ADD CONSTRAINT "ClientCredit_financialRecordPaymentId_fkey"
  FOREIGN KEY ("financialRecordPaymentId") REFERENCES "FinancialRecordPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientCredit" DROP CONSTRAINT IF EXISTS "ClientCredit_userId_fkey";
ALTER TABLE "ClientCredit"
  ADD CONSTRAINT "ClientCredit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Trava de segurança: o saldo do cliente nunca pode ficar negativo,
--    independentemente do caminho de código que fizer o UPDATE.
ALTER TABLE "Client"
  DROP CONSTRAINT IF EXISTS "Client_creditBalance_non_negative";

ALTER TABLE "Client"
  ADD CONSTRAINT "Client_creditBalance_non_negative" CHECK ("creditBalance" >= 0);
