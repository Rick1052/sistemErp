-- ---------------------------------------------------------------------------
-- Backfill: datas gravadas em 00:00 UTC (aparecem um dia antes no Brasil)
--
-- Causa: sale.schema.js usava z.coerce.date(), que convertia "YYYY-MM-DD" em
-- 00:00:00 UTC. Como as colunas são TIMESTAMP(3) em UTC e a interface exibe no
-- fuso local (UTC-3), 2026-08-12T00:00:00Z era mostrado como 11/08/2026.
-- O PIX evidenciava o problema porque, sendo recebimento imediato, o
-- createAndPay copia a data da venda para dueDate/paymentDate e para o extrato.
--
-- Este script reancora essas datas no MEIO-DIA UTC, mesmo critério que o
-- parseDateInput passou a aplicar — assim a data fica estável em qualquer fuso
-- do Brasil. Só toca linhas cujo horário é exatamente 00:00:00.000, que é a
-- assinatura de uma data "pura" (sem hora) mal convertida.
--
-- COMO USAR
--   1. Rode a seção 1 (conferência) e confira os volumes.
--   2. Rode a seção 2 (transação). Ela termina em COMMIT — troque por ROLLBACK
--      se quiser só simular.
--   3. Rode a seção 3 para confirmar que zerou.
-- ---------------------------------------------------------------------------


-- =====================  1. CONFERÊNCIA (somente leitura)  ===================

SELECT 'Sale.date'                        AS coluna, count(*) AS linhas_afetadas FROM "Sale"                   WHERE "date"::time          = '00:00:00'
UNION ALL SELECT 'Sale.chequeDueDate',              count(*) FROM "Sale"                   WHERE "chequeDueDate"::time = '00:00:00'
UNION ALL SELECT 'FinancialRecord.date',            count(*) FROM "FinancialRecord"        WHERE "date"::time          = '00:00:00'
UNION ALL SELECT 'FinancialRecord.dueDate',         count(*) FROM "FinancialRecord"        WHERE "dueDate"::time       = '00:00:00'
UNION ALL SELECT 'FinancialRecord.paymentDate',     count(*) FROM "FinancialRecord"        WHERE "paymentDate"::time   = '00:00:00'
UNION ALL SELECT 'FinancialRecord.chequeDueDate',   count(*) FROM "FinancialRecord"        WHERE "chequeDueDate"::time = '00:00:00'
UNION ALL SELECT 'FinancialRecordPayment.paymentDate', count(*) FROM "FinancialRecordPayment" WHERE "paymentDate"::time = '00:00:00'
UNION ALL SELECT 'BankTransaction.date',            count(*) FROM "BankTransaction"        WHERE "date"::time          = '00:00:00'
UNION ALL SELECT 'Budget.date',                     count(*) FROM "Budget"                 WHERE "date"::time          = '00:00:00'
UNION ALL SELECT 'Budget.validUntil',               count(*) FROM "Budget"                 WHERE "validUntil"::time    = '00:00:00'
ORDER BY 1;

-- Amostra do antes/depois, para validar o efeito antes de aplicar:
SELECT s.cod,
       s."date"                        AS gravado_utc,
       (s."date" + interval '12 hours') AS depois_utc,
       to_char(s."date"              AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS exibe_hoje,
       to_char((s."date" + interval '12 hours') AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS exibe_depois
FROM "Sale" s
WHERE s."date"::time = '00:00:00'
ORDER BY s.cod DESC
LIMIT 20;


-- =====================  2. CORREÇÃO (transação)  ===========================

BEGIN;

UPDATE "Sale"
   SET "date" = "date" + interval '12 hours'
 WHERE "date"::time = '00:00:00';

UPDATE "Sale"
   SET "chequeDueDate" = "chequeDueDate" + interval '12 hours'
 WHERE "chequeDueDate"::time = '00:00:00';

UPDATE "FinancialRecord"
   SET "date" = "date" + interval '12 hours'
 WHERE "date"::time = '00:00:00';

UPDATE "FinancialRecord"
   SET "dueDate" = "dueDate" + interval '12 hours'
 WHERE "dueDate"::time = '00:00:00';

UPDATE "FinancialRecord"
   SET "paymentDate" = "paymentDate" + interval '12 hours'
 WHERE "paymentDate"::time = '00:00:00';

UPDATE "FinancialRecord"
   SET "chequeDueDate" = "chequeDueDate" + interval '12 hours'
 WHERE "chequeDueDate"::time = '00:00:00';

UPDATE "FinancialRecordPayment"
   SET "paymentDate" = "paymentDate" + interval '12 hours'
 WHERE "paymentDate"::time = '00:00:00';

-- Extrato bancário: mantém a data da baixa que o originou
UPDATE "BankTransaction"
   SET "date" = "date" + interval '12 hours'
 WHERE "date"::time = '00:00:00';

UPDATE "Budget"
   SET "date" = "date" + interval '12 hours'
 WHERE "date"::time = '00:00:00';

UPDATE "Budget"
   SET "validUntil" = "validUntil" + interval '12 hours'
 WHERE "validUntil"::time = '00:00:00';

COMMIT;


-- =====================  3. VERIFICAÇÃO PÓS  ================================
-- Todas as linhas devem voltar 0.

SELECT 'Sale.date'                        AS coluna, count(*) AS restantes FROM "Sale"                   WHERE "date"::time          = '00:00:00'
UNION ALL SELECT 'Sale.chequeDueDate',              count(*) FROM "Sale"                   WHERE "chequeDueDate"::time = '00:00:00'
UNION ALL SELECT 'FinancialRecord.date',            count(*) FROM "FinancialRecord"        WHERE "date"::time          = '00:00:00'
UNION ALL SELECT 'FinancialRecord.dueDate',         count(*) FROM "FinancialRecord"        WHERE "dueDate"::time       = '00:00:00'
UNION ALL SELECT 'FinancialRecord.paymentDate',     count(*) FROM "FinancialRecord"        WHERE "paymentDate"::time   = '00:00:00'
UNION ALL SELECT 'FinancialRecord.chequeDueDate',   count(*) FROM "FinancialRecord"        WHERE "chequeDueDate"::time = '00:00:00'
UNION ALL SELECT 'FinancialRecordPayment.paymentDate', count(*) FROM "FinancialRecordPayment" WHERE "paymentDate"::time = '00:00:00'
UNION ALL SELECT 'BankTransaction.date',            count(*) FROM "BankTransaction"        WHERE "date"::time          = '00:00:00'
UNION ALL SELECT 'Budget.date',                     count(*) FROM "Budget"                 WHERE "date"::time          = '00:00:00'
UNION ALL SELECT 'Budget.validUntil',               count(*) FROM "Budget"                 WHERE "validUntil"::time    = '00:00:00'
ORDER BY 1;
