-- Add attachedLlm field to WorkspaceCallingFunction
-- Stores the agent type for DELEGATE_TO_AGENT functions (e.g. "PRODUCT_SEARCH", "CART_MANAGEMENT")
ALTER TABLE "workspace_calling_functions" ADD COLUMN IF NOT EXISTS "attachedLlm" TEXT;

-- Populate attachedLlm for existing DELEGATE_TO_AGENT functions
UPDATE "workspace_calling_functions" SET "attachedLlm" = 'PRODUCT_SEARCH' WHERE "functionName" = 'productSearchAgent' AND "executionType" = 'DELEGATE_TO_AGENT' AND "attachedLlm" IS NULL;
UPDATE "workspace_calling_functions" SET "attachedLlm" = 'CART_MANAGEMENT' WHERE "functionName" = 'cartManagementAgent' AND "executionType" = 'DELEGATE_TO_AGENT' AND "attachedLlm" IS NULL;
UPDATE "workspace_calling_functions" SET "attachedLlm" = 'ORDER_TRACKING' WHERE "functionName" = 'orderTrackingAgent' AND "executionType" = 'DELEGATE_TO_AGENT' AND "attachedLlm" IS NULL;
UPDATE "workspace_calling_functions" SET "attachedLlm" = 'CUSTOMER_SUPPORT' WHERE "functionName" = 'customerSupportAgent' AND "executionType" = 'DELEGATE_TO_AGENT' AND "attachedLlm" IS NULL;
UPDATE "workspace_calling_functions" SET "attachedLlm" = 'PROFILE_MANAGEMENT' WHERE "functionName" = 'profileManagementAgent' AND "executionType" = 'DELEGATE_TO_AGENT' AND "attachedLlm" IS NULL;
