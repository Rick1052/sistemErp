-- Campos de conferência do rascunho de NFe (revisados antes do envio à SEFAZ)
ALTER TABLE "NfeEmission"
  ADD COLUMN "dataEmissao" TIMESTAMP(3),
  ADD COLUMN "dataSaida" TIMESTAMP(3),
  ADD COLUMN "paymentMethodId" TEXT;

ALTER TABLE "NfeEmission"
  ADD CONSTRAINT "NfeEmission_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
