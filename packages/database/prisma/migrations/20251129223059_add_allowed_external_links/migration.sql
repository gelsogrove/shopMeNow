-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "allowedExternalLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];
