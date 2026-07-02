-- Emissão de NFe via Focus NFe: campos fiscais em Company/Product/ProductTax/Sale
-- e novas tabelas NfeConfig / NfeEmission

-- 1) Enums
CREATE TYPE "NfeAmbiente" AS ENUM ('homologacao', 'producao');
CREATE TYPE "NfeStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'AUTORIZADO', 'ERRO', 'CANCELADO');

-- 2) Company: dados fiscais
ALTER TABLE "Company"
  ADD COLUMN "ie" TEXT,
  ADD COLUMN "regimeTributario" INTEGER,
  ADD COLUMN "cnae" TEXT;

-- 3) CompanySequence: contador de emissões de NFe
ALTER TABLE "CompanySequence"
  ADD COLUMN "nfeEmissionSeq" INTEGER NOT NULL DEFAULT 0;

-- 4) Product: unidade comercial
ALTER TABLE "Product"
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'UN';

-- 5) ProductTax: CFOP e CSTs
ALTER TABLE "ProductTax"
  ADD COLUMN "cfop" TEXT,
  ADD COLUMN "icmsCst" TEXT,
  ADD COLUMN "icmsAliquota" DECIMAL(5,2),
  ADD COLUMN "pisCst" TEXT,
  ADD COLUMN "pisAliquota" DECIMAL(5,2),
  ADD COLUMN "cofinsCst" TEXT,
  ADD COLUMN "cofinsAliquota" DECIMAL(5,2);

-- 6) Sale: campos fiscais da NFe
ALTER TABLE "Sale"
  ADD COLUMN "naturezaOperacao" TEXT,
  ADD COLUMN "finalidadeEmissao" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "tipoDocumento" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "localDestino" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "consumidorFinal" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "presencaComprador" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "modalidadeFrete" INTEGER NOT NULL DEFAULT 9;

-- 7) NfeConfig (1:1 com Company)
CREATE TABLE "NfeConfig" (
    "companyId" TEXT NOT NULL,
    "ambiente" "NfeAmbiente" NOT NULL DEFAULT 'homologacao',
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "tokenProducaoEnc" TEXT,
    "tokenHomologacaoEnc" TEXT,
    "certificadoValidoDe" TIMESTAMP(3),
    "certificadoValidoAte" TIMESTAMP(3),
    "certificadoCnpj" TEXT,
    "serieNfeProducao" TEXT NOT NULL DEFAULT '1',
    "serieNfeHomologacao" TEXT NOT NULL DEFAULT '1',
    "naturezaOperacaoPadrao" TEXT NOT NULL DEFAULT 'Venda de mercadoria',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfeConfig_pkey" PRIMARY KEY ("companyId")
);

ALTER TABLE "NfeConfig"
  ADD CONSTRAINT "NfeConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8) NfeEmission (histórico de emissão vinculado à venda)
CREATE TABLE "NfeEmission" (
    "id" TEXT NOT NULL,
    "cod" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "status" "NfeStatus" NOT NULL DEFAULT 'PENDENTE',
    "statusSefaz" TEXT,
    "mensagemSefaz" TEXT,
    "chaveNfe" TEXT,
    "numero" TEXT,
    "serie" TEXT,
    "caminhoXml" TEXT,
    "caminhoDanfe" TEXT,
    "erros" JSONB,
    "justificativaCancelamento" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfeEmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NfeEmission_saleId_key" ON "NfeEmission"("saleId");
CREATE UNIQUE INDEX "NfeEmission_ref_key" ON "NfeEmission"("ref");
CREATE UNIQUE INDEX "NfeEmission_companyId_cod_key" ON "NfeEmission"("companyId", "cod");
CREATE INDEX "NfeEmission_companyId_idx" ON "NfeEmission"("companyId");

ALTER TABLE "NfeEmission"
  ADD CONSTRAINT "NfeEmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfeEmission"
  ADD CONSTRAINT "NfeEmission_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
