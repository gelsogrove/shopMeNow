-- WasenderAPI webhook signature verification (Andrea, 2026-08-16):
-- WasenderAPI sends its per-session webhook secret in the X-Webhook-Signature
-- header; previously we never verified it, relying only on sessionId in the body.
ALTER TABLE "Workspace" ADD COLUMN "wasenderWebhookSecret" TEXT;
