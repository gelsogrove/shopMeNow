import { prisma } from '../config/database'
import { sendJobErrorAlert } from './email-alert.service'
import logger from '../utils/logger'

const JOB_STATUS_ENABLED = process.env.ENABLE_SCHEDULER_JOB_STATUS !== 'false'

export async function runJob(jobName: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now()

  const touchJobStatus = async (status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED', errorMsg?: string, durationMs?: number) => {
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
      logger.warn(`[SchedulerJobStatus] Could not update status for ${jobName}: ${(err as Error).message}`)
    }
  }

  if (JOB_STATUS_ENABLED) {
    try {
      const jobStatus = await prisma.schedulerJobStatus.findUnique({
        where: { jobName },
        select: { isActive: true },
      })
      if (jobStatus && !jobStatus.isActive) {
        await touchJobStatus('SKIPPED')
        logger.warn(`[JobRunner] ${jobName} is disabled (isActive = false). Skipping run.`)
        return
      }
    } catch (err) {
      logger.warn(`[JobRunner] Status check failed for ${jobName}: ${(err as Error).message}. Continuing run.`)
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
