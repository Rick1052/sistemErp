-- Financial partial settlements support
-- - Add PARTIALLY_PAID to FinancialStatus enum
-- - Add paidAmount to FinancialRecord
-- - Create FinancialRecordPayment table
-- - Link BankTransaction optionally to FinancialRecordPayment

-- 1) Enum extension (Postgres)
ALTER TYPE "FinancialStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

-- 2) paidAmount column
ALTER TABLE "FinancialRecord"
  ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- 3) FinancialRecordPayment table
CREATE TABLE IF NOT EXISTS "FinancialRecordPayment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "financialRecordId" TEXT NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bankAccountId" TEXT NOT NULL,
  "paymentMethodId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialRecordPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FinancialRecordPayment_companyId_idx" ON "FinancialRecordPayment"("companyId");
CREATE INDEX IF NOT EXISTS "FinancialRecordPayment_financialRecordId_idx" ON "FinancialRecordPayment"("financialRecordId");
CREATE INDEX IF NOT EXISTS "FinancialRecordPayment_paymentDate_idx" ON "FinancialRecordPayment"("paymentDate");

ALTER TABLE "FinancialRecordPayment"
  ADD CONSTRAINT "FinancialRecordPayment_financialRecordId_fkey"
  FOREIGN KEY ("financialRecordId") REFERENCES "FinancialRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialRecordPayment"
  ADD CONSTRAINT "FinancialRecordPayment_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialRecordPayment"
  ADD CONSTRAINT "FinancialRecordPayment_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4) Optional link from BankTransaction -> FinancialRecordPayment
ALTER TABLE "BankTransaction"
  ADD COLUMN IF NOT EXISTS "financialRecordPaymentId" TEXT;

CREATE INDEX IF NOT EXISTS "BankTransaction_financialRecordPaymentId_idx" ON "BankTransaction"("financialRecordPaymentId");

ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_financialRecordPaymentId_fkey"
  FOREIGN KEY ("financialRecordPaymentId") REFERENCES "FinancialRecordPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) Backfill: for already PAID titles, set paidAmount=amount when paidAmount is zero
UPDATE "FinancialRecord"
SET "paidAmount" = "amount"
WHERE "status" = 'PAID' AND ("paidAmount" IS NULL OR "paidAmount" = 0);

