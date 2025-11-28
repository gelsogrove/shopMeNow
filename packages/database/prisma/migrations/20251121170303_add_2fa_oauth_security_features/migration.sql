-- DropForeignKey
ALTER TABLE "public"."gdpr_content" DROP CONSTRAINT "gdpr_content_workspaceId_fkey";

-- DropIndex
DROP INDEX "public"."gdpr_content_workspaceId_idx";

-- AlterTable
ALTER TABLE "gdpr_content" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "linkedProviders" JSONB DEFAULT '[]',
ADD COLUMN     "profilePicture" TEXT,
ADD COLUMN     "recoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorEnabledAt" TIMESTAMP(3),
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "authentication_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "attemptType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authentication_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "authentication_attempts_email_timestamp_idx" ON "authentication_attempts"("email", "timestamp");

-- CreateIndex
CREATE INDEX "authentication_attempts_ipAddress_timestamp_idx" ON "authentication_attempts"("ipAddress", "timestamp");

-- CreateIndex
CREATE INDEX "authentication_attempts_attemptType_success_idx" ON "authentication_attempts"("attemptType", "success");

-- CreateIndex
CREATE INDEX "authentication_attempts_timestamp_idx" ON "authentication_attempts"("timestamp");

-- AddForeignKey
ALTER TABLE "authentication_attempts" ADD CONSTRAINT "authentication_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gdpr_content" ADD CONSTRAINT "gdpr_content_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
