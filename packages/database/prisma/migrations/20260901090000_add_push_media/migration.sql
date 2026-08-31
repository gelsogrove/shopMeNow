-- Merchant push photos uploaded from the admin's computer (Andrea, 2026-09-01)
-- + media delivery through the WhatsApp queue: the campaign snapshot points at
-- the public photo URL and the queue processor attaches it via
-- provider.sendMediaMessage. Idempotent: may be applied by hand before the
-- release-phase `prisma migrate deploy` runs the same file.
ALTER TABLE "merchant_pushes" ADD COLUMN IF NOT EXISTS "photoBase64" TEXT;
ALTER TABLE "whatsapp_queue" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
