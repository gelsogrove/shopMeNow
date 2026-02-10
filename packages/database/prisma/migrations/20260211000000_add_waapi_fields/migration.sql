-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "waapiInstanceId" TEXT,
ADD COLUMN     "waapiInstanceStatus" TEXT,
ADD COLUMN     "waapiPhoneNumber" TEXT,
ADD COLUMN     "waapiPhoneName" TEXT,
ADD COLUMN     "waapiWebhookUrl" TEXT,
ADD COLUMN     "waapiWebhookEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "waapiQrCodeData" TEXT,
ADD COLUMN     "waapiQrGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "waapiIsActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "waapiLastSyncAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Workspace_waapiInstanceId_idx" ON "Workspace"("waapiInstanceId");
