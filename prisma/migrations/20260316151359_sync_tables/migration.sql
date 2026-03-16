/*
  Warnings:

  - The values [BAL] on the enum `MovementType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `reason` to the `StockMovement` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StockAction" AS ENUM ('NONE', 'RESERVE', 'COMMIT');

-- CreateEnum
CREATE TYPE "FinancialRecordType" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateEnum
CREATE TYPE "FinancialStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('REVENUE', 'EXPENSE');

-- AlterEnum
BEGIN;
CREATE TYPE "MovementType_new" AS ENUM ('IN', 'OUT', 'BALANCE', 'RESERVE', 'RELEASE_RESERVE');
ALTER TABLE "StockMovement" ALTER COLUMN "type" TYPE "MovementType_new" USING ("type"::text::"MovementType_new");
ALTER TYPE "MovementType" RENAME TO "MovementType_old";
ALTER TYPE "MovementType_new" RENAME TO "MovementType";
DROP TYPE "public"."MovementType_old";
COMMIT;

-- AlterTable
ALTER TABLE "CompanySequence" ADD COLUMN     "accountSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "financialCategorySeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "financialRecordSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMethodSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "saleItemSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "saleSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "saleStatusSeq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "averageCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "depth" DECIMAL(15,2),
ADD COLUMN     "height" DECIMAL(15,2),
ADD COLUMN     "physicalStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reservedStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weight" DECIMAL(15,3),
ADD COLUMN     "width" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "ProductTax" ADD COLUMN     "cest" TEXT,
ADD COLUMN     "gtin" TEXT,
ADD COLUMN     "icmsOwnAmount" DECIMAL(15,2),
ADD COLUMN     "icmsStAmount" DECIMAL(15,2),
ADD COLUMN     "icmsStBase" DECIMAL(15,2),
ADD COLUMN     "ipiTaxClass" TEXT,
ADD COLUMN     "ncm" TEXT,
ADD COLUMN     "origin" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "documentRef" TEXT,
ADD COLUMN     "reason" TEXT NOT NULL,
ADD COLUMN     "unitCost" DECIMAL(15,2);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "cod" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "freight" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "cod" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleStatus" (
    "id" TEXT NOT NULL,
    "cod" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "stockAction" "StockAction" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "cod" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initialBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "cod" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destinationAccountId" TEXT,
    "feePercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isImmediate" BOOLEAN NOT NULL DEFAULT true,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "cod" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialRecord" (
    "id" TEXT NOT NULL,
    "cod" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "FinancialRecordType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "status" "FinancialStatus" NOT NULL DEFAULT 'PENDING',
    "bankAccountId" TEXT,
    "paymentMethodId" TEXT,
    "categoryId" TEXT,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "financialRecordId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "balanceAfter" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_companyId_idx" ON "Sale"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_companyId_cod_key" ON "Sale"("companyId", "cod");

-- CreateIndex
CREATE INDEX "SaleItem_companyId_idx" ON "SaleItem"("companyId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_companyId_cod_key" ON "SaleItem"("companyId", "cod");

-- CreateIndex
CREATE INDEX "SaleStatus_companyId_idx" ON "SaleStatus"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleStatus_companyId_name_key" ON "SaleStatus"("companyId", "name");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_idx" ON "BankAccount"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_companyId_cod_key" ON "BankAccount"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_companyId_name_key" ON "BankAccount"("companyId", "name");

-- CreateIndex
CREATE INDEX "PaymentMethod_companyId_idx" ON "PaymentMethod"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_companyId_cod_key" ON "PaymentMethod"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_companyId_name_key" ON "PaymentMethod"("companyId", "name");

-- CreateIndex
CREATE INDEX "FinancialCategory_companyId_idx" ON "FinancialCategory"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_companyId_cod_key" ON "FinancialCategory"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_companyId_name_key" ON "FinancialCategory"("companyId", "name");

-- CreateIndex
CREATE INDEX "FinancialRecord_companyId_idx" ON "FinancialRecord"("companyId");

-- CreateIndex
CREATE INDEX "FinancialRecord_saleId_idx" ON "FinancialRecord"("saleId");

-- CreateIndex
CREATE INDEX "FinancialRecord_status_idx" ON "FinancialRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialRecord_companyId_cod_key" ON "FinancialRecord"("companyId", "cod");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_idx" ON "BankTransaction"("bankAccountId");

-- CreateIndex
CREATE INDEX "BankTransaction_date_idx" ON "BankTransaction"("date");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "SaleStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleStatus" ADD CONSTRAINT "SaleStatus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_financialRecordId_fkey" FOREIGN KEY ("financialRecordId") REFERENCES "FinancialRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
