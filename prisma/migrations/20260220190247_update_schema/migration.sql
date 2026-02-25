/*
  Warnings:

  - The primary key for the `UserCompany` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `UserCompany` table. All the data in the column will be lost.
  - The `role` column on the `UserCompany` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- DropIndex
DROP INDEX "UserCompany_userId_companyId_key";

-- AlterTable
ALTER TABLE "UserCompany" DROP CONSTRAINT "UserCompany_pkey",
DROP COLUMN "id",
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'ADMIN',
ADD CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("userId", "companyId");
