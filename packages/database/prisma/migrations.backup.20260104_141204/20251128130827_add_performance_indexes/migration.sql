-- CreateIndex
CREATE INDEX "idx_workspace_customer" ON "chat_sessions"("workspaceId", "customerId");

-- CreateIndex
CREATE INDEX "idx_chat_session_created" ON "chat_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "idx_workspace_created" ON "chat_sessions"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_message_created" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "idx_direction_created" ON "messages"("direction", "createdAt");

-- CreateIndex
CREATE INDEX "idx_msg_session_created" ON "messages"("chatSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_session_direction" ON "messages"("chatSessionId", "direction");
