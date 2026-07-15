-- CreateEnum
CREATE TYPE "PlatformSubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "asaasCustomerId" TEXT;

-- CreateTable
CREATE TABLE "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "asaasCustomerId" TEXT NOT NULL,
    "asaasSubscriptionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "billingType" TEXT NOT NULL DEFAULT 'UNDEFINED',
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "status" "PlatformSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCharge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "asaasPaymentId" TEXT NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSubscription_companyId_key" ON "PlatformSubscription"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSubscription_asaasSubscriptionId_key" ON "PlatformSubscription"("asaasSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCharge_asaasPaymentId_key" ON "PlatformCharge"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "PlatformCharge_companyId_idx" ON "PlatformCharge"("companyId");

-- CreateIndex
CREATE INDEX "PlatformCharge_subscriptionId_idx" ON "PlatformCharge"("subscriptionId");

-- AddForeignKey
ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCharge" ADD CONSTRAINT "PlatformCharge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCharge" ADD CONSTRAINT "PlatformCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PlatformSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

