-- Reverse-direction translation flag: auto-translate customer messages to
-- the operator's language, complementing the existing
-- translateOperatorMessages (operator -> customer).

ALTER TABLE "Workspace" ADD COLUMN "translateCustomerMessages" BOOLEAN NOT NULL DEFAULT true;
