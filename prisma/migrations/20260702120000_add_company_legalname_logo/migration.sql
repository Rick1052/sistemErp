-- Add razão social and logo to Company profile
ALTER TABLE "Company"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "logo" TEXT;
