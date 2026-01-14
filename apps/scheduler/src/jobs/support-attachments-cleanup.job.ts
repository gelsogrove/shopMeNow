import { prisma } from '../config/database'
import { SupportTicketStatus, Prisma } from '@echatbot/database'
import logger from '../utils/logger'
import fetch from 'node-fetch'

/**
 * Support Attachments Cleanup Job
 * 
 * Runs daily at 23:25 (after soft-delete-cleanup at 23:20)
 * Deletes attachments from closed support tickets older than X days
 * 
 * SAFETY:
 * - Uses SchedulerJobStatus to prevent duplicate runs
 * - Only deletes attachments from CLOSED tickets
 * - Deletes from storage first, then from database
 * - Logs all operations for audit
 * 
 * ENV VARS:
 * - SUPPORT_ATTACHMENTS_RETENTION_DAYS: Number of days to keep attachments (default: 90)
 * - CLOUDINARY_CLOUD_NAME: For cloudinary storage
 * - CLOUDINARY_API_KEY: For cloudinary storage
 * - CLOUDINARY_API_SECRET: For cloudinary storage
 */

const DEFAULT_RETENTION_DAYS = 90

function getRetentionDays(): number {
  const envValue = process.env.SUPPORT_ATTACHMENTS_RETENTION_DAYS
  if (!envValue) return DEFAULT_RETENTION_DAYS
  
  const parsed = parseInt(envValue, 10)
  if (isNaN(parsed) || parsed < 1) {
    logger.warn(`Invalid SUPPORT_ATTACHMENTS_RETENTION_DAYS value "${envValue}", using default ${DEFAULT_RETENTION_DAYS}`)
    return DEFAULT_RETENTION_DAYS
  }
  return parsed
}

/**
 * Delete file from Cloudinary storage
 */
async function deleteFromCloudinary(storageKey: string): Promise<boolean> {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
      logger.warn('Cloudinary credentials not configured, skipping storage deletion')
      return false
    }

    // Cloudinary delete API
    const timestamp = Math.round(Date.now() / 1000)
    const crypto = await import('crypto')
    const signature = crypto.createHash('sha1')
      .update(`public_id=${storageKey}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex')

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          public_id: storageKey,
          timestamp: timestamp.toString(),
          api_key: apiKey,
          signature,
        }),
      }
    )

    const result = await response.json() as { result: string }
    return result.result === 'ok'
  } catch (error) {
    logger.error('Failed to delete from Cloudinary:', { storageKey, error })
    return false
  }
}

export async function supportAttachmentsCleanupJob(): Promise<void> {
  const startTime = Date.now()
  
  // 1. Prevent duplicate runs (check if already ran today)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const jobStatus = await prisma.schedulerJobStatus.findUnique({
    where: { jobName: 'support-attachments-cleanup' }
  })
  
  if (jobStatus?.lastRunAt && jobStatus.lastRunAt > today) {
    logger.info('[SupportAttachmentsCleanup] Already ran today, skipping')
    return
  }

  // 2. Calculate expiry date
  const retentionDays = getRetentionDays()
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() - retentionDays)

  logger.info(`[SupportAttachmentsCleanup] Starting cleanup for attachments older than ${retentionDays} days (before ${expiryDate.toISOString()})`)

  // 3. Find attachments from closed tickets older than retention period
  const attachments = await prisma.supportAttachment.findMany({
    where: {
      message: {
        ticket: {
          status: SupportTicketStatus.CLOSED,
          closedAt: { lt: expiryDate },
        },
      },
    },
    include: {
      message: {
        select: {
          ticketId: true,
          ticket: {
            select: {
              ticketCode: true,
              closedAt: true,
            },
          },
        },
      },
    },
  })

  logger.info(`[SupportAttachmentsCleanup] Found ${attachments.length} attachments to cleanup`)

  if (attachments.length === 0) {
    // Update job status even if no work done
    await prisma.schedulerJobStatus.upsert({
      where: { jobName: 'support-attachments-cleanup' },
      update: {
        lastRunAt: new Date(),
        lastStatus: 'success',
        lastError: null,
        lastDuration: Date.now() - startTime,
      },
      create: {
        jobName: 'support-attachments-cleanup',
        lastRunAt: new Date(),
        lastStatus: 'success',
        lastError: null,
        lastDuration: Date.now() - startTime,
      },
    })
    logger.info('[SupportAttachmentsCleanup] No attachments to cleanup')
    return
  }

  // 4. Delete attachments
  let deletedCount = 0
  let failedCount = 0

  for (const attachment of attachments) {
    try {
      // Delete from storage first
      const storageDeleted = await deleteFromCloudinary(attachment.storageKey)
      
      if (storageDeleted) {
        logger.debug(`[SupportAttachmentsCleanup] Deleted from storage: ${attachment.storageKey}`)
      } else {
        logger.warn(`[SupportAttachmentsCleanup] Could not delete from storage (may not exist): ${attachment.storageKey}`)
      }

      // Delete from database regardless (storage may have been manually deleted)
      await prisma.supportAttachment.delete({
        where: { id: attachment.id },
      })

      deletedCount++
      
      logger.debug(`[SupportAttachmentsCleanup] Deleted attachment ${attachment.id} from ticket ${attachment.message.ticket.ticketCode}`)
    } catch (error) {
      failedCount++
      logger.error('[SupportAttachmentsCleanup] Failed to delete attachment:', {
        attachmentId: attachment.id,
        ticketCode: attachment.message.ticket.ticketCode,
        error,
      })
    }
  }

  // 5. Update job status
  const duration = Date.now() - startTime
  const message = `Deleted ${deletedCount} attachments, ${failedCount} failed`

  await prisma.schedulerJobStatus.upsert({
    where: { jobName: 'support-attachments-cleanup' },
    update: {
      lastRunAt: new Date(),
      lastStatus: failedCount === 0 ? 'success' : 'partial',
      lastError: failedCount > 0 ? message : null,
      lastDuration: duration,
    },
    create: {
      jobName: 'support-attachments-cleanup',
      lastRunAt: new Date(),
      lastStatus: failedCount === 0 ? 'success' : 'partial',
      lastError: failedCount > 0 ? message : null,
      lastDuration: duration,
    },
  })

  logger.info(`[SupportAttachmentsCleanup] ${message} in ${duration}ms`)
}
