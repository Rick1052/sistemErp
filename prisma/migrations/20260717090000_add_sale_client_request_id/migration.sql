-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_companyId_clientRequestId_key" ON "Sale"("companyId", "clientRequestId");

