-- CreateTable
CREATE TABLE "product_searches" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_searches_workspaceId_idx" ON "product_searches"("workspaceId");

-- CreateIndex
CREATE INDEX "product_searches_customerId_idx" ON "product_searches"("customerId");

-- CreateIndex
CREATE INDEX "product_searches_createdAt_idx" ON "product_searches"("createdAt");

-- CreateIndex
CREATE INDEX "product_searches_query_idx" ON "product_searches"("query");

-- AddForeignKey
ALTER TABLE "product_searches" ADD CONSTRAINT "product_searches_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_searches" ADD CONSTRAINT "product_searches_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
