/*
  Warnings:

  - You are about to drop the column `city` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `cnpj` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `fantasyName` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `legalName` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `municipalRegistration` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `number` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `stateRegistration` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `street` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `taxRegime` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `zipcode` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `active` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AccountPayable` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AccountReceivable` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BankAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BankTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Client` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FinancialCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SalesOrder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SalesOrderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockMovement` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `Company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AccountPayable" DROP CONSTRAINT "AccountPayable_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "AccountPayable" DROP CONSTRAINT "AccountPayable_companyId_fkey";

-- DropForeignKey
ALTER TABLE "AccountReceivable" DROP CONSTRAINT "AccountReceivable_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "AccountReceivable" DROP CONSTRAINT "AccountReceivable_clientId_fkey";

-- DropForeignKey
ALTER TABLE "AccountReceivable" DROP CONSTRAINT "AccountReceivable_companyId_fkey";

-- DropForeignKey
ALTER TABLE "AccountReceivable" DROP CONSTRAINT "AccountReceivable_salesOrderId_fkey";

-- DropForeignKey
ALTER TABLE "BankAccount" DROP CONSTRAINT "BankAccount_companyId_fkey";

-- DropForeignKey
ALTER TABLE "BankTransaction" DROP CONSTRAINT "BankTransaction_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "BankTransaction" DROP CONSTRAINT "BankTransaction_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinancialCategory" DROP CONSTRAINT "FinancialCategory_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_clientId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_userId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrderItem" DROP CONSTRAINT "SalesOrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrderItem" DROP CONSTRAINT "SalesOrderItem_salesOrderId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- DropIndex
DROP INDEX "Company_cnpj_key";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "city",
DROP COLUMN "cnpj",
DROP COLUMN "email",
DROP COLUMN "fantasyName",
DROP COLUMN "legalName",
DROP COLUMN "municipalRegistration",
DROP COLUMN "number",
DROP COLUMN "phone",
DROP COLUMN "state",
DROP COLUMN "stateRegistration",
DROP COLUMN "street",
DROP COLUMN "taxRegime",
DROP COLUMN "updatedAt",
DROP COLUMN "zipcode",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "active",
DROP COLUMN "companyId",
DROP COLUMN "passwordHash",
DROP COLUMN "role",
ADD COLUMN     "password" TEXT NOT NULL;

-- DropTable
DROP TABLE "AccountPayable";

-- DropTable
DROP TABLE "AccountReceivable";

-- DropTable
DROP TABLE "BankAccount";

-- DropTable
DROP TABLE "BankTransaction";

-- DropTable
DROP TABLE "Client";

-- DropTable
DROP TABLE "FinancialCategory";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "SalesOrder";

-- DropTable
DROP TABLE "SalesOrderItem";

-- DropTable
DROP TABLE "StockMovement";

-- DropEnum
DROP TYPE "BankReferenceType";

-- DropEnum
DROP TYPE "BankTransactionType";

-- DropEnum
DROP TYPE "ClientType";

-- DropEnum
DROP TYPE "FinancialStatus";

-- DropEnum
DROP TYPE "FinancialType";

-- DropEnum
DROP TYPE "SalesOrderStatus";

-- DropEnum
DROP TYPE "StockMovementType";

-- DropEnum
DROP TYPE "StockReferenceType";

-- DropEnum
DROP TYPE "TaxRegime";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "UserCompany" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',

    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCompany_userId_companyId_key" ON "UserCompany"("userId", "companyId");

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
