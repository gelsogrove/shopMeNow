-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "wasenderApiKey" TEXT,
ADD COLUMN     "wasenderIsActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wasenderPhoneNumber" TEXT,
ADD COLUMN     "wasenderQrGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "wasenderQrString" TEXT,
ADD COLUMN     "wasenderSessionId" TEXT,
ADD COLUMN     "wasenderSessionStatus" TEXT,
ALTER COLUMN "whatsappProvider" SET DEFAULT 'waapi';

-- CreateIndex
CREATE INDEX "Workspace_wasenderApiKey_idx" ON "Workspace"("wasenderApiKey");
