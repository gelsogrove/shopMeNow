-- Retry/backoff for failed WhatsApp queue sends (Andrea, 2026-08-16):
-- previously a single send failure marked the message "error" forever with
-- no retry. Adds a bounded exponential-backoff retry before dead-lettering.
ALTER TABLE "whatsapp_queue" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "whatsapp_queue" ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "whatsapp_queue" ADD COLUMN "nextRetryAt" TIMESTAMP(3);
