-- CreateEnum
CREATE TYPE "AsaasEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "AsaasSubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "asaasCustomerId" TEXT;

-- CreateTable
CREATE TABLE "AsaasConfig" (
    "companyId" TEXT NOT NULL,
    "environment" "AsaasEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKeySandboxEnc" TEXT,
    "apiKeyProducaoEnc" TEXT,
    "webhookToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsaasConfig_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "AsaasSubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "asaasSubscriptionId" TEXT NOT NULL,
    "asaasCustomerId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "billingType" TEXT NOT NULL DEFAULT 'UNDEFINED',
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "status" "AsaasSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsaasSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsaasCharge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "asaasPaymentId" TEXT NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "financialRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsaasCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AsaasConfig_webhookToken_key" ON "AsaasConfig"("webhookToken");

-- CreateIndex
CREATE UNIQUE INDEX "AsaasSubscription_asaasSubscriptionId_key" ON "AsaasSubscription"("asaasSubscriptionId");

-- CreateIndex
CREATE INDEX "AsaasSubscription_companyId_idx" ON "AsaasSubscription"("companyId");

-- CreateIndex
CREATE INDEX "AsaasSubscription_clientId_idx" ON "AsaasSubscription"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AsaasCharge_asaasPaymentId_key" ON "AsaasCharge"("asaasPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "AsaasCharge_financialRecordId_key" ON "AsaasCharge"("financialRecordId");

-- CreateIndex
CREATE INDEX "AsaasCharge_companyId_idx" ON "AsaasCharge"("companyId");

-- CreateIndex
CREATE INDEX "AsaasCharge_subscriptionId_idx" ON "AsaasCharge"("subscriptionId");

-- CreateIndex
CREATE INDEX "AsaasCharge_clientId_idx" ON "AsaasCharge"("clientId");

-- AddForeignKey
ALTER TABLE "AsaasConfig" ADD CONSTRAINT "AsaasConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasSubscription" ADD CONSTRAINT "AsaasSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasSubscription" ADD CONSTRAINT "AsaasSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasCharge" ADD CONSTRAINT "AsaasCharge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasCharge" ADD CONSTRAINT "AsaasCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AsaasSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasCharge" ADD CONSTRAINT "AsaasCharge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsaasCharge" ADD CONSTRAINT "AsaasCharge_financialRecordId_fkey" FOREIGN KEY ("financialRecordId") REFERENCES "FinancialRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

