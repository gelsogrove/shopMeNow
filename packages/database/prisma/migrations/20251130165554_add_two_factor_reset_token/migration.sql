-- CreateTable
CREATE TABLE "two_factor_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" VARCHAR(36) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminId" TEXT NOT NULL,
    "passwordAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "two_factor_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_reset_tokens_token_key" ON "two_factor_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "two_factor_reset_tokens_token_idx" ON "two_factor_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "two_factor_reset_tokens_userId_createdAt_idx" ON "two_factor_reset_tokens"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "two_factor_reset_tokens_expiresAt_idx" ON "two_factor_reset_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "two_factor_reset_tokens" ADD CONSTRAINT "two_factor_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_reset_tokens" ADD CONSTRAINT "two_factor_reset_tokens_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
