ALTER TABLE "users"
ADD COLUMN "paypalAccessTokenEncrypted" TEXT,
ADD COLUMN "paypalRefreshTokenEncrypted" TEXT,
ADD COLUMN "paypalTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "paypalTokenScope" TEXT;
