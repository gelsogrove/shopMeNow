-- PayPal webhook de-duplication.
--
-- PayPal retries a webhook delivery until it receives a 200, and the
-- signature on a replayed delivery is still valid — signature verification
-- alone does not make the handler idempotent. Without a dedup key, one
-- BILLING.SUBSCRIPTION.PAYMENT.SUCCESS could increment paypalCyclesCompleted
-- more than once, and a replayed PAYMENT.FAILED could inflate
-- paypalFailedPaymentsCount (Andrea, 2026-09-14).
--
-- Mirrors whatsapp_webhook_events, minus workspaceId: PayPal mandates are
-- owner-level (Feature 198 owner-based billing), not per workspace.

CREATE TABLE IF NOT EXISTS "paypal_webhook_events" (
  "id"         TEXT NOT NULL,
  "eventId"    TEXT NOT NULL,
  "eventType"  TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "paypal_webhook_events_pkey" PRIMARY KEY ("id")
);

-- The dedup key: a second delivery of the same event id is rejected by this
-- index, which is what the handler catches as P2002 to answer "duplicate".
CREATE UNIQUE INDEX IF NOT EXISTS "paypal_webhook_events_eventId_key"
  ON "paypal_webhook_events" ("eventId");

-- Retention sweeps delete by age.
CREATE INDEX IF NOT EXISTS "paypal_webhook_events_receivedAt_idx"
  ON "paypal_webhook_events" ("receivedAt");
