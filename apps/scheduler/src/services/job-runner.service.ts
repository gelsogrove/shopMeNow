import { prisma } from '../config/database'
import { sendJobErrorAlert } from './email-alert.service'
import logger from '../utils/logger'

export async function runJob(jobName: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now()

  // Mark as RUNNING
  await prisma.schedulerJobStatus.upsert({
    where: { jobName },
    create: { 
      jobName, 
      lastStatus: 'RUNNING', 
      lastRunAt: new Date() 
    },
    update: { 
      lastStatus: 'RUNNING', 
      lastRunAt: new Date(), 
      lastError: null 
    },
  })

  try {
    logger.info(`⏰ Starting job: ${jobName}`)
    await fn()

    // Mark as SUCCESS
    const duration = Date.now() - start
    await prisma.schedulerJobStatus.update({
      where: { jobName },
      data: {
        lastStatus: 'SUCCESS',
        lastDuration: duration,
        lastError: null,
      },
    })
    logger.info(`✅ Job completed: ${jobName} (${duration}ms)`)

  } catch (error) {
    const errorMsg = (error as Error).message
    const duration = Date.now() - start

    // Mark as FAILED
    await prisma.schedulerJobStatus.update({
      where: { jobName },
      data: {
        lastStatus: 'FAILED',
        lastDuration: duration,
        lastError: errorMsg,
      },
    })

    logger.error(`❌ Job FAILED: ${jobName} - ${errorMsg}`)
    
    // Send email alert
    await sendJobErrorAlert(jobName, error as Error)
  }
}
