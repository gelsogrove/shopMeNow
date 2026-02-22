-- AlterTable: add operator handoff tracking fields to customers
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "operatorRequestedAt" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "originChannel" TEXT;
