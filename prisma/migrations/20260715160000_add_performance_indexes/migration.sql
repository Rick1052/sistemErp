-- CreateIndex
CREATE INDEX "FinancialRecord_companyId_status_dueDate_idx" ON "FinancialRecord"("companyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "FinancialRecord_companyId_type_dueDate_idx" ON "FinancialRecord"("companyId", "type", "dueDate");

-- CreateIndex
CREATE INDEX "Sale_companyId_date_idx" ON "Sale"("companyId", "date");

