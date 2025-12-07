-- Feature 198: Move billing fields from Workspace to User (Owner-based billing)
-- Credit is SHARED across ALL owned workspaces

-- ============================================================================
-- PHASE 1: Add new columns to users table
-- ============================================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "creditBalance" DECIMAL(10,2) NOT NULL DEFAULT 19.00;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastPaymentFailedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lowBalanceNotifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nextBillingDate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pauseRequestedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "paymentFailureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pendingPlanEffectiveDate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pendingPlanType" "PlanType";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "planStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "planType" "PlanType" NOT NULL DEFAULT 'FREE_TRIAL';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- ============================================================================
-- PHASE 2: Migrate billing data from workspaces to their owners
-- For each user, take the HIGHEST plan and SUM of credits from all owned workspaces
-- ============================================================================

-- Create a temporary function to map plan priority (for taking the best plan)
CREATE OR REPLACE FUNCTION get_plan_priority(plan "PlanType") RETURNS INTEGER AS $$
BEGIN
  RETURN CASE plan
    WHEN 'ENTERPRISE' THEN 4
    WHEN 'PREMIUM' THEN 3
    WHEN 'BASIC' THEN 2
    WHEN 'FREE_TRIAL' THEN 1
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql;

-- Migrate data: For each owner, aggregate billing from all their workspaces
UPDATE "users" u SET
  "creditBalance" = COALESCE(agg.total_credit, 19.00),
  "planType" = COALESCE(agg.best_plan, 'FREE_TRIAL'),
  "subscriptionStatus" = COALESCE(agg.status, 'ACTIVE'),
  "planStartedAt" = COALESCE(agg.earliest_start, CURRENT_TIMESTAMP),
  "nextBillingDate" = agg.next_billing,
  "trialEndsAt" = agg.trial_ends,
  "pausedAt" = agg.paused,
  "pauseRequestedAt" = agg.pause_requested,
  "pendingPlanType" = agg.pending_plan,
  "pendingPlanEffectiveDate" = agg.pending_date,
  "lastPaymentFailedAt" = agg.last_failed,
  "paymentFailureCount" = COALESCE(agg.max_failures, 0),
  "lowBalanceNotifiedAt" = agg.low_balance_notified
FROM (
  SELECT 
    w."ownerId" as owner_id,
    SUM(w."creditBalance") as total_credit,
    (SELECT w2."planType" 
     FROM "Workspace" w2 
     WHERE w2."ownerId" = w."ownerId" AND w2."deletedAt" IS NULL
     ORDER BY get_plan_priority(w2."planType") DESC 
     LIMIT 1) as best_plan,
    -- For subscription status: ACTIVE wins over PAUSE_PENDING, PAUSED, PAYMENT_FAILED
    (SELECT w2."subscriptionStatus"
     FROM "Workspace" w2
     WHERE w2."ownerId" = w."ownerId" AND w2."deletedAt" IS NULL
     ORDER BY CASE w2."subscriptionStatus"
       WHEN 'ACTIVE' THEN 1
       WHEN 'PAUSE_PENDING' THEN 2
       WHEN 'PAUSED' THEN 3
       WHEN 'PAYMENT_FAILED' THEN 4
     END
     LIMIT 1) as status,
    MIN(w."planStartedAt") as earliest_start,
    MIN(w."nextBillingDate") as next_billing,
    MIN(w."trialEndsAt") as trial_ends,
    MAX(w."pausedAt") as paused,
    MAX(w."pauseRequestedAt") as pause_requested,
    (SELECT w2."pendingPlanType"
     FROM "Workspace" w2
     WHERE w2."ownerId" = w."ownerId" AND w2."deletedAt" IS NULL AND w2."pendingPlanType" IS NOT NULL
     ORDER BY get_plan_priority(w2."pendingPlanType") DESC
     LIMIT 1) as pending_plan,
    MIN(w."pendingPlanEffectiveDate") as pending_date,
    MAX(w."lastPaymentFailedAt") as last_failed,
    MAX(w."paymentFailureCount") as max_failures,
    MAX(w."lowBalanceNotifiedAt") as low_balance_notified
  FROM "Workspace" w
  WHERE w."ownerId" IS NOT NULL AND w."deletedAt" IS NULL
  GROUP BY w."ownerId"
) agg
WHERE u.id = agg.owner_id;

-- Drop the temporary function
DROP FUNCTION IF EXISTS get_plan_priority;

-- ============================================================================
-- PHASE 3: Update billing_transactions to add userId
-- ============================================================================

-- First add userId as nullable
ALTER TABLE "billing_transactions" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Populate userId from workspace owner
UPDATE "billing_transactions" bt SET
  "userId" = w."ownerId"
FROM "Workspace" w
WHERE bt."workspaceId" = w.id AND bt."userId" IS NULL;

-- For any orphaned transactions (workspace deleted or no owner), assign to first admin user
UPDATE "billing_transactions" SET
  "userId" = (SELECT id FROM "users" WHERE "isPlatformAdmin" = true LIMIT 1)
WHERE "userId" IS NULL;

-- If still null (no admin user exists), create a placeholder - but this shouldn't happen in production
-- Just to be safe, we'll set it to the first user if any exist
UPDATE "billing_transactions" SET
  "userId" = (SELECT id FROM "users" LIMIT 1)
WHERE "userId" IS NULL;

-- Now make userId required
ALTER TABLE "billing_transactions" ALTER COLUMN "userId" SET NOT NULL;

-- Drop old foreign key constraint on workspaceId
ALTER TABLE "billing_transactions" DROP CONSTRAINT IF EXISTS "billing_transactions_workspaceId_fkey";

-- Make workspaceId nullable
ALTER TABLE "billing_transactions" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- ============================================================================
-- PHASE 4: Create indexes and foreign keys
-- ============================================================================

-- Create index on userId for billing_transactions
CREATE INDEX IF NOT EXISTS "billing_transactions_userId_idx" ON "billing_transactions"("userId");

-- Create indexes on users table
CREATE INDEX IF NOT EXISTS "users_planType_idx" ON "users"("planType");
CREATE INDEX IF NOT EXISTS "users_subscriptionStatus_idx" ON "users"("subscriptionStatus");

-- Add foreign key for userId
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add nullable foreign key for workspaceId (for operation tracking)
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_workspaceId_fkey" 
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- DONE! Billing is now on User (Owner) level
-- The DEPRECATED fields on Workspace will be removed in a future migration
-- ============================================================================
