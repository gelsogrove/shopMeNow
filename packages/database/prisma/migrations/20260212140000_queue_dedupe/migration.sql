-- Add push campaign linkage and dedupe to whatsapp_queue
ALTER TABLE "whatsapp_queue"
ADD COLUMN "pushCampaignId" TEXT,
ADD COLUMN "pushCampaignRecipientId" TEXT;

-- Unique per recipient to prevent duplicate enqueue
CREATE UNIQUE INDEX "whatsapp_queue_pushCampaignRecipientId_key"
  ON "whatsapp_queue"("pushCampaignRecipientId");

-- Foreign keys (set null on delete to avoid cascade surprises)
ALTER TABLE "whatsapp_queue"
  ADD CONSTRAINT "whatsapp_queue_pushCampaignId_fkey"
  FOREIGN KEY ("pushCampaignId") REFERENCES "PushCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_queue"
  ADD CONSTRAINT "whatsapp_queue_pushCampaignRecipientId_fkey"
  FOREIGN KEY ("pushCampaignRecipientId") REFERENCES "PushCampaignRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
