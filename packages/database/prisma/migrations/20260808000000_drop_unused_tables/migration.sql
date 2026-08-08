-- Drop tables with no runtime usage anywhere in the codebase (audit 2026-08-08):
-- - registration_attempts: dismissed by Feature 174, only cleanup deletes remained
-- - pending_appointments / appointment_gdpr_logs: never written nor read
-- - documents: RAG feature disabled, no create/read path exists

-- DropForeignKey
ALTER TABLE "appointment_gdpr_logs" DROP CONSTRAINT "appointment_gdpr_logs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "pending_appointments" DROP CONSTRAINT "pending_appointments_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "pending_appointments" DROP CONSTRAINT "pending_appointments_workspaceId_fkey";

-- DropTable
DROP TABLE "appointment_gdpr_logs";

-- DropTable
DROP TABLE "documents";

-- DropTable
DROP TABLE "pending_appointments";

-- DropTable
DROP TABLE "registration_attempts";

-- DropEnum
DROP TYPE "DocumentStatus";
