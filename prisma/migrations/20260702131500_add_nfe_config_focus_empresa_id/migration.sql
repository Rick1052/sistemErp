-- Guarda o id numérico da empresa retornado pela Focus NFe (necessário para PUT /v2/empresas/{id})
ALTER TABLE "NfeConfig"
  ADD COLUMN "focusEmpresaId" INTEGER;
