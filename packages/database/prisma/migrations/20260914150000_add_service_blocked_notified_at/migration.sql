-- Throttle for the "your chatbot has stopped answering" email (2026-09-14).
-- Separate from lowBalanceNotifiedAt: that warns while the service still runs,
-- this reports it is already down. Before this column there was no email at
-- all at the moment of the block — the owner found out from angry customers.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "serviceBlockedNotifiedAt" TIMESTAMP(3);
