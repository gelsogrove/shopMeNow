-- Add WhatsApp App Secret for per-channel webhook signature verification
ALTER TABLE "whatsapp_settings"
ADD COLUMN IF NOT EXISTS "appSecret" TEXT;
