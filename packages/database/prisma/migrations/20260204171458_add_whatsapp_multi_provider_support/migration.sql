-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "metaAccessToken" TEXT,
ADD COLUMN     "metaPhoneNumberId" TEXT,
ADD COLUMN     "ultraMsgInstanceId" TEXT,
ADD COLUMN     "ultraMsgToken" TEXT,
ADD COLUMN     "webhookVerifyToken" TEXT,
ADD COLUMN     "whatsappProvider" TEXT NOT NULL DEFAULT 'meta';
