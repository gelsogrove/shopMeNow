-- Add WhatsApp Business API fields
ALTER TABLE "Workspace"
ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" TEXT,
ADD COLUMN IF NOT EXISTS "whatsappVerifyToken" TEXT;
