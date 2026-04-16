-- AlterEnum
ALTER TYPE "MaterialCategory" ADD VALUE IF NOT EXISTS 'PRODUCT';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "productInnovationDescription" TEXT;
