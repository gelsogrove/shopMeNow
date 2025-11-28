-- AlterTable: Add isActive column to scheduler_job_status
ALTER TABLE "scheduler_job_status" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
