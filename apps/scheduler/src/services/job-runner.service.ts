import { prisma } from '../config/database'
import { sendJobErrorAlert } from './email-alert.service'
import logger from '../utils/logger'

const JOB_STATUS_ENABLED = process.env.ENABLE_SCHEDULER_JOB_STATUS !== 'false'
const DEFAULT_LOCK_TTL_MS = 15 * 60 * 1000

export async function runJob(jobName: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now()
  const startedAt = new Date()

  const touchJobStatus = async (
    status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED',
    errorMsg?: string,
    durationMs?: number
  ) => {
    if (!JOB_STATUS_ENABLED) return
    try {
      await prisma.schedulerJobStatus.upsert({
        where: { jobName },
        create: {
          jobName,
          isActive: true,
          lastStatus: status,
          lastRunAt: new Date(),
          lastDuration: durationMs,
          lastError: errorMsg ?? null,
        },
        update: {
          lastStatus: status,
          lastRunAt: new Date(),
          lastDuration: durationMs,
          lastError: errorMsg ?? null,
        },
      })
    } catch (err) {
      logger.warn(
        `[SchedulerJobStatus] Could not update status for ${jobName}: ${(err as Error).message}`
      )
    }
  }

  if (JOB_STATUS_ENABLED) {
    try {
      // Ensure row exists so lock attempts work reliably
      await prisma.schedulerJobStatus.upsert({
        where: { jobName },
        create: {
          jobName,
          isActive: true,
          lastStatus: 'NEVER_RUN',
        },
        update: {},
      })

      const jobStatus = await prisma.schedulerJobStatus.findUnique({
        where: { jobName },
        select: { isActive: true },
      })

      if (jobStatus && !jobStatus.isActive) {
        await touchJobStatus('SKIPPED')
        logger.warn(`[JobRunner] ${jobName} is disabled (isActive = false). Skipping run.`)
        return
      }

      const lockTtlMs = Number(process.env.SCHEDULER_LOCK_TTL_MS || DEFAULT_LOCK_TTL_MS)
      const staleBefore = new Date(Date.now() - lockTtlMs)

      // Distributed lock via SchedulerJobStatus
      const lock = await prisma.schedulerJobStatus.updateMany({
        where: {
          jobName,
          isActive: true,
          OR: [
            { lastStatus: { not: 'RUNNING' } },
            { lastRunAt: null },
            { lastRunAt: { lt: staleBefore } },
          ],
        },
        data: {
          lastStatus: 'RUNNING',
          lastRunAt: startedAt,
          lastError: null,
        },
      })

      if (lock.count === 0) {
        logger.warn(`[JobRunner] ${jobName} already running (lock held). Skipping run.`)
        return
      }
    } catch (err) {
      logger.warn(`[JobRunner] Lock check failed for ${jobName}: ${(err as Error).message}. Continuing run.`)
    }
  }

  await touchJobStatus('RUNNING')

  try {
    // Silent execution - no log spam for routine jobs
    await fn()

    const duration = Date.now() - start
    await touchJobStatus('SUCCESS', undefined, duration)
  } catch (error) {
    const errorMsg = (error as Error).message
    const duration = Date.now() - start

    await touchJobStatus('FAILED', errorMsg, duration)

    logger.error(`❌ Job FAILED: ${jobName} - ${errorMsg}`)

    // Send email alert
    await sendJobErrorAlert(jobName, error as Error)
  }
}
