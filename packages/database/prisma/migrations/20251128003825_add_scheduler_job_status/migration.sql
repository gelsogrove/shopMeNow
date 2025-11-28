-- CreateTable
CREATE TABLE "scheduler_job_status" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'NEVER_RUN',
    "lastError" TEXT,
    "lastDuration" INTEGER,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduler_job_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduler_job_status_jobName_key" ON "scheduler_job_status"("jobName");
