-- CreateEnum
CREATE TYPE "PaymentValueDestination" AS ENUM ('RECEIVABLE_ONLY', 'BANK_ACCOUNT');

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN "valueDestination" "PaymentValueDestination" NOT NULL DEFAULT 'RECEIVABLE_ONLY';

-- Quem já tinha conta de destino configurada passa a ser explícito BANK_ACCOUNT
UPDATE "PaymentMethod" SET "valueDestination" = 'BANK_ACCOUNT' WHERE "destinationAccountId" IS NOT NULL;
