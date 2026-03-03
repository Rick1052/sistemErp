/*
  Warnings:

  - You are about to drop the column `cest` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `depth` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `expirationDate` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `gtin` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `isVariant` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `ncm` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `icmsOwnAmount` on the `ProductTax` table. All the data in the column will be lost.
  - You are about to drop the column `icmsStAmount` on the `ProductTax` table. All the data in the column will be lost.
  - You are about to drop the column `icmsStBase` on the `ProductTax` table. All the data in the column will be lost.
  - You are about to drop the column `ipiTaxClass` on the `ProductTax` table. All the data in the column will be lost.
  - You are about to drop the column `origin` on the `ProductTax` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[companyId,cod]` on the table `Brand` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,cod]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,cod]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cod]` on the table `Company` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,cod]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,cod]` on the table `ProductInventory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,cod]` on the table `ProductTax` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,cod]` on the table `StockMovement` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,cod]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,cod]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,cod]` on the table `Warehouse` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cod` to the `Brand` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `Company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `ProductInventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `ProductTax` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `StockMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `Supplier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `Tag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cod` to the `Warehouse` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_parentId_fkey";

-- DropIndex
DROP INDEX "StockMovement_productId_idx";

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "cest",
DROP COLUMN "depth",
DROP COLUMN "expirationDate",
DROP COLUMN "gtin",
DROP COLUMN "height",
DROP COLUMN "isVariant",
DROP COLUMN "ncm",
DROP COLUMN "parentId",
DROP COLUMN "weight",
DROP COLUMN "width",
ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ProductInventory" ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ProductTax" DROP COLUMN "icmsOwnAmount",
DROP COLUMN "icmsStAmount",
DROP COLUMN "icmsStBase",
DROP COLUMN "ipiTaxClass",
DROP COLUMN "origin",
ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "cod" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "cod" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "CompanySequence" (
    "companyId" TEXT NOT NULL,
    "clientSeq" INTEGER NOT NULL DEFAULT 0,
    "supplierSeq" INTEGER NOT NULL DEFAULT 0,
    "brandSeq" INTEGER NOT NULL DEFAULT 0,
    "categorySeq" INTEGER NOT NULL DEFAULT 0,
    "tagSeq" INTEGER NOT NULL DEFAULT 0,
    "warehouseSeq" INTEGER NOT NULL DEFAULT 0,
    "productSeq" INTEGER NOT NULL DEFAULT 0,
    "productTaxSeq" INTEGER NOT NULL DEFAULT 0,
    "inventorySeq" INTEGER NOT NULL DEFAULT 0,
    "stockMovementSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySequence_pkey" PRIMARY KEY ("companyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_companyId_cod_key" ON "Brand"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "Category_companyId_cod_key" ON "Category"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyId_cod_key" ON "Client"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "Company_cod_key" ON "Company"("cod");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_cod_key" ON "Product"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInventory_companyId_cod_key" ON "ProductInventory"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTax_companyId_cod_key" ON "ProductTax"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_companyId_cod_key" ON "StockMovement"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_cod_key" ON "Supplier"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_companyId_cod_key" ON "Tag"("companyId", "cod");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_cod_key" ON "Warehouse"("companyId", "cod");

-- AddForeignKey
ALTER TABLE "CompanySequence" ADD CONSTRAINT "CompanySequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
