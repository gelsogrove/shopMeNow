-- Courtesy message on security block (Andrea, 2026-08-16):
-- when the final SecurityAgent check blocks an outbound reply, the customer
-- previously received total silence. If this workspace column is set, that
-- text is sent instead; null keeps the silent behavior. Content lives in DB
-- per rule 1A (no customer-facing copy in code).
ALTER TABLE "Workspace" ADD COLUMN "securityBlockedMessage" TEXT;
