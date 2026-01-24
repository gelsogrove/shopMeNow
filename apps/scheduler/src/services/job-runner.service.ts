import { prisma } from '../config/database'
import { sendJobErrorAlert } from './email-alert.service'
import logger from '../utils/logger'

export async function runJob(jobName: string, fn: () => Promise<void>): Promise<void> {
  // TEMPORARY FIX: Skip job status check due to ECONNREFUSED error
  // TODO: Investigate why scheduler gets ECONNREFUSED on SchedulerJobStatus queries
  // const jobStatus = await prisma.schedulerJobStatus.findUnique({
  //   where: { jobName },
  //   select: { isActive: true }
  // })

  // If job exists and is disabled, skip execution (silent - no log spam)
  // if (jobStatus && !jobStatus.isActive) {
  //   await prisma.schedulerJobStatus.update({
  //     where: { jobName },
  //     data: { 
  //       lastStatus: 'SKIPPED',
  //       lastRunAt: new Date(),
  //       lastError: null
  //     }
  //   })
  //   return
  // }

  const start = Date.now()

  // TEMPORARY FIX: Comment all SchedulerJobStatus operations due to ECONNREFUSED
  // TODO: Investigate why scheduler cannot access SchedulerJobStatus table
  // await prisma.schedulerJobStatus.upsert({
  //   where: { jobName },
  //   create: { 
  //     jobName, 
  //     isActive: true,
  //     lastStatus: 'RUNNING', 
  //     lastRunAt: new Date() 
  //   },
  //   update: { 
  //     lastStatus: 'RUNNING', 
  //     lastRunAt: new Date(), 
  //     lastError: null 
  //   },
  // })

  try {
    // Silent execution - no log spam for routine jobs
    await fn()

    // Mark as SUCCESS (TEMPORARILY DISABLED)
    // const duration = Date.now() - start
    // await prisma.schedulerJobStatus.update({
    //   where: { jobName },
    //   data: {
    //     lastStatus: 'SUCCESS',
    //     lastDuration: duration,
    //     lastError: null,
    //   },
    // })

  } catch (error) {
    // const errorMsg = (error as Error).message
    // const duration = Date.now() - start

    // Mark as FAILED (TEMPORARILY DISABLED)
    // await prisma.schedulerJobStatus.update({
    //   where: { jobName },
    //   data: {
    //     lastStatus: 'FAILED',
    //     lastDuration: duration,
    //     lastError: errorMsg,
    //   },
    // })

    logger.error(`❌ Job FAILED: ${jobName} - ${(error as Error).message}`)
    
    // Send email alert
    await sendJobErrorAlert(jobName, error as Error)
  }
}
