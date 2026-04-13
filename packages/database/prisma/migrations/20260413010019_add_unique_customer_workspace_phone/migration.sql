-- AddUniqueConstraint: prevent duplicate customers with same phone in same workspace
-- This enforces at DB level what was previously only application-level dedup (race condition risk).
-- PostgreSQL treats NULL != NULL, so multiple NULL phones in same workspace are still allowed.
CREATE UNIQUE INDEX "customers_workspaceId_phone_key" ON "customers"("workspaceId", "phone");
