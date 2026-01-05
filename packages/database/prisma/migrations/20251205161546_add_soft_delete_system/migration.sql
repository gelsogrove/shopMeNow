-- AddColumn deletedAt to Workspace
ALTER TABLE "Workspace" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AddColumn deletedAt to Customers
ALTER TABLE "customers" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AddColumn deletedAt to Orders
ALTER TABLE "orders" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AddColumn deletedAt to OrderItems
ALTER TABLE "order_items" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AddColumn deletedAt to User
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AddColumn deletedAt to ChatSession
ALTER TABLE "chat_sessions" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AddColumn deletedAt to Message
ALTER TABLE "messages" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create SoftDeleteAuditLog table
CREATE TABLE "soft_delete_audit_logs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "deletedIds" TEXT[],
  "deletedIdCount" INTEGER NOT NULL,
  "reason" TEXT,
  "deletedByUserId" TEXT,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "soft_delete_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Add Indexes for soft delete queries (deletedAt)
CREATE INDEX "Workspace_deletedAt_idx" ON "Workspace"("deletedAt");
CREATE INDEX "customers_deletedAt_idx" ON "customers"("deletedAt");
CREATE INDEX "customers_workspaceId_deletedAt_idx" ON "customers"("workspaceId", "deletedAt");
CREATE INDEX "orders_deletedAt_idx" ON "orders"("deletedAt");
CREATE INDEX "orders_workspaceId_deletedAt_idx" ON "orders"("workspaceId", "deletedAt");
CREATE INDEX "order_items_deletedAt_idx" ON "order_items"("deletedAt");
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");
CREATE INDEX "chat_sessions_deletedAt_idx" ON "chat_sessions"("deletedAt");
CREATE INDEX "chat_sessions_workspaceId_deletedAt_idx" ON "chat_sessions"("workspaceId", "deletedAt");
CREATE INDEX "messages_deletedAt_idx" ON "messages"("deletedAt");

-- Add indexes for audit log
CREATE INDEX "soft_delete_audit_logs_workspaceId_deletedAt_idx" ON "soft_delete_audit_logs"("workspaceId", "deletedAt");
CREATE INDEX "soft_delete_audit_logs_deletedAt_idx" ON "soft_delete_audit_logs"("deletedAt");

-- Add foreign key for SoftDeleteAuditLog -> Workspace
ALTER TABLE "soft_delete_audit_logs" ADD CONSTRAINT "soft_delete_audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
