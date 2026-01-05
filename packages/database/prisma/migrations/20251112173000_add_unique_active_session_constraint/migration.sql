-- AlterTable
-- 🔒 CONCURRENCY SAFETY: Add unique constraint to prevent duplicate active sessions
-- This ensures only ONE active session per customer at any time

-- Step 1: Create unique constraint on (customerId, status)
-- This will fail if duplicate active sessions exist (we already verified there are none)
CREATE UNIQUE INDEX "unique_active_session" ON "chat_sessions"("customerId", "status");

-- Step 2: Create index for performance on (customerId, status) queries
CREATE INDEX "idx_customer_status" ON "chat_sessions"("customerId", "status");

-- Step 3: Create index for workspace isolation queries
CREATE INDEX "idx_workspace" ON "chat_sessions"("workspaceId");

-- Migration complete
-- ✅ Now multiple concurrent requests will be handled safely:
--    - First request creates session
--    - Second concurrent request gets P2002 error (unique violation)
--    - Transaction retry logic in code handles P2002 gracefully
