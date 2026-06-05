-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN "bankName" TEXT,
ADD COLUMN "accountKind" TEXT NOT NULL DEFAULT 'BANK';
