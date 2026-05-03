-- CreateTable
CREATE TABLE "playground_todos" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dialogId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "messageContent" TEXT NOT NULL,
    "chatbotResponse" TEXT,
    "commentTitle" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medio',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playground_todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playground_comments" (
    "id" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playground_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "playground_todos_workspaceId_status_idx" ON "playground_todos"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "playground_todos_dialogId_idx" ON "playground_todos"("dialogId");

-- CreateIndex
CREATE INDEX "playground_comments_todoId_createdAt_idx" ON "playground_comments"("todoId", "createdAt");

-- AddForeignKey
ALTER TABLE "playground_comments" ADD CONSTRAINT "playground_comments_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "playground_todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
