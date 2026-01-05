-- Remove QUERY_ANALYZER and TRANSLATION from AgentType enum
-- Manual migration created on 2025-11-10 22:16:14

-- AlterEnum: Remove values from AgentType
ALTER TYPE "AgentType" RENAME TO "AgentType_old";

CREATE TYPE "AgentType" AS ENUM (
  'ROUTER',
  'PRODUCT_SEARCH',
  'CART_MANAGEMENT',
  'ORDER_TRACKING',
  'CUSTOMER_SUPPORT',
  'PROFILE_MANAGEMENT',
  'NOTIFICATIONS',
  'SAFETY_TRANSLATION',
  'CUSTOM'
);

-- Update existing data in agent_configs table
ALTER TABLE "agent_configs" ALTER COLUMN "type" TYPE "AgentType" USING ("type"::text::"AgentType");

-- Update existing data in search_conversations table
ALTER TABLE "search_conversations" ALTER COLUMN "activeAgent" TYPE "AgentType" USING ("activeAgent"::text::"AgentType");

-- Drop old enum
DROP TYPE "AgentType_old";
