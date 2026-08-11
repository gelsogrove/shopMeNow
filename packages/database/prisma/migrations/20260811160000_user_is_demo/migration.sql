-- Demo account flag: hides the billing "Plans" block and the PayPal
-- connection blocks in the frontend for demo accounts.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isDemoUser" BOOLEAN NOT NULL DEFAULT false;
