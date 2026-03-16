-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "installmentInterval" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "installments" INTEGER NOT NULL DEFAULT 1;
