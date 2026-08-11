-- Real PayPal checkout for credit recharges (credit-wallet model).
--
-- The recharge flow now creates a PayPal Orders v2 order and credits the
-- wallet only after a successful server-side capture. paypalOrderId is the
-- idempotency key: a second capture attempt for the same order finds the
-- SUCCESS row and does not credit twice.
--
-- IF NOT EXISTS: applied to production ahead of the deploy via direct SQL,
-- so this migration must be idempotent when migrate deploy runs.

ALTER TABLE "paypal_transactions" ADD COLUMN IF NOT EXISTS "paypalOrderId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "paypal_transactions_paypalOrderId_key" ON "paypal_transactions"("paypalOrderId");
