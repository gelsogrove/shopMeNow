-- AlterTable
ALTER TABLE "public"."Workspace" ADD COLUMN     "apiKey" TEXT,
ADD COLUMN     "apiSecret" TEXT,
ADD COLUMN     "metadata" JSONB;
