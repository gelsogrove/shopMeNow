-- Track inbound WhatsApp webhook events to prevent duplicate processing (Meta retries)
CREATE TABLE "whatsapp_webhook_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_webhook_events_workspaceId_channel_externalMessageId_key"
ON "whatsapp_webhook_events"("workspaceId", "channel", "externalMessageId");

CREATE INDEX "whatsapp_webhook_events_workspaceId_idx"
ON "whatsapp_webhook_events"("workspaceId");

CREATE INDEX "whatsapp_webhook_events_receivedAt_idx"
ON "whatsapp_webhook_events"("receivedAt");

ALTER TABLE "whatsapp_webhook_events"
ADD CONSTRAINT "whatsapp_webhook_events_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
