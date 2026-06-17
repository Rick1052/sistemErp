-- Budgets module + Sale cheque/installments fields (schema drift from db push)

-- 1) Budget status enum
DO $$ BEGIN
  CREATE TYPE "BudgetStatus" AS ENUM (
    'DRAFT',
    'OPEN',
    'SENT',
    'NEGOTIATION',
    'APPROVED',
    'REJECTED',
    'CONVERTED',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Company sequence counters for budgets
ALTER TABLE "CompanySequence"
  ADD COLUMN IF NOT EXISTS "budgetSeq" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "budgetItemSeq" INTEGER NOT NULL DEFAULT 0;

-- 3) Sale fields used by pedidos (may exist if applied via db push)
ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "installmentsData" JSONB,
  ADD COLUMN IF NOT EXISTS "chequeNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "chequeOwner" TEXT,
  ADD COLUMN IF NOT EXISTS "chequeDueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "chequeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "chequeHistory" TEXT;

-- Normaliza strings vazias antes da FK (dados legados do front)
UPDATE "Sale"
SET "chequeCustomerId" = NULL
WHERE "chequeCustomerId" IS NOT NULL AND BTRIM("chequeCustomerId") = '';

DO $$ BEGIN
  ALTER TABLE "Sale"
    ADD CONSTRAINT "Sale_chequeCustomerId_fkey"
    FOREIGN KEY ("chequeCustomerId") REFERENCES "Client"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4) Budget tables
CREATE TABLE IF NOT EXISTS "Budget" (
  "id" TEXT NOT NULL,
  "cod" INTEGER NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "sellerId" TEXT,
  "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "subtotal" DECIMAL(15,2) NOT NULL,
  "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "freight" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(15,2) NOT NULL,
  "notes" TEXT,
  "paymentTerms" TEXT,
  "paymentMethodId" TEXT,
  "leadOrigin" TEXT,
  "competitor" TEXT,
  "lossReason" TEXT,
  "commercialNotes" TEXT,
  "convertedSaleId" TEXT,
  "sentAt" TIMESTAMP(3),
  "lastFollowUpAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BudgetItem" (
  "id" TEXT NOT NULL,
  "cod" INTEGER NOT NULL,
  "companyId" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(15,2) NOT NULL,
  "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(15,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BudgetHistory" (
  "id" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BudgetHistory_pkey" PRIMARY KEY ("id")
);

-- 5) Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Budget_companyId_cod_key" ON "Budget"("companyId", "cod");
CREATE INDEX IF NOT EXISTS "Budget_companyId_idx" ON "Budget"("companyId");
CREATE INDEX IF NOT EXISTS "Budget_clientId_idx" ON "Budget"("clientId");
CREATE INDEX IF NOT EXISTS "Budget_sellerId_idx" ON "Budget"("sellerId");
CREATE INDEX IF NOT EXISTS "Budget_status_idx" ON "Budget"("status");
CREATE INDEX IF NOT EXISTS "Budget_validUntil_idx" ON "Budget"("validUntil");
CREATE UNIQUE INDEX IF NOT EXISTS "Budget_convertedSaleId_key" ON "Budget"("convertedSaleId");

CREATE UNIQUE INDEX IF NOT EXISTS "BudgetItem_companyId_cod_key" ON "BudgetItem"("companyId", "cod");
CREATE INDEX IF NOT EXISTS "BudgetItem_companyId_idx" ON "BudgetItem"("companyId");
CREATE INDEX IF NOT EXISTS "BudgetItem_budgetId_idx" ON "BudgetItem"("budgetId");

CREATE INDEX IF NOT EXISTS "BudgetHistory_budgetId_idx" ON "BudgetHistory"("budgetId");

-- 6) Foreign keys
DO $$ BEGIN
  ALTER TABLE "Budget"
    ADD CONSTRAINT "Budget_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Budget"
    ADD CONSTRAINT "Budget_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Budget"
    ADD CONSTRAINT "Budget_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Budget"
    ADD CONSTRAINT "Budget_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Budget"
    ADD CONSTRAINT "Budget_convertedSaleId_fkey"
    FOREIGN KEY ("convertedSaleId") REFERENCES "Sale"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BudgetItem"
    ADD CONSTRAINT "BudgetItem_budgetId_fkey"
    FOREIGN KEY ("budgetId") REFERENCES "Budget"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BudgetItem"
    ADD CONSTRAINT "BudgetItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BudgetHistory"
    ADD CONSTRAINT "BudgetHistory_budgetId_fkey"
    FOREIGN KEY ("budgetId") REFERENCES "Budget"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BudgetHistory"
    ADD CONSTRAINT "BudgetHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
