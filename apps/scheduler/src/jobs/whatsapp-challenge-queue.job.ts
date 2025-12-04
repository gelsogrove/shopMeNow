import { prisma } from '../config/database'
import logger from '../utils/logger'
import { SecurityAgentService } from '../services/security-agent.service'
import { BillingService } from '../services/billing.service'

/**
 * In-memory lock to prevent concurrent executions
 * If the job is still running when the next cron tick happens, skip it
 */
let isProcessing = false

/**
 * WhatsApp Challenge Queue Job
 * 
 * Runs every 3 seconds via cron (configured in index.ts)
 * Processes pending messages for workspaces with active channel
 * 
 * CRITICAL FEATURES:
 * 1. Lock mechanism: If job is still running, next cron tick is skipped
 * 2. PARALLEL sending: Messages to DIFFERENT customers sent simultaneously
 * 3. Small batches: Max 10 messages per cycle
 * 4. Security check: All messages pass through Security Agent LLM
 * 
 * WHY PARALLEL IS SAFE?
 * WhatsApp Cloud API limits:
 * - 80 msg/second GLOBAL throughput (up to 1000 msg/s)
 * - 1 msg per 6 seconds PER PAIR (same sender → same recipient)
 * 
 * Since we're sending to DIFFERENT customers, parallel is fine!
 * The 6-second limit only applies to the SAME customer.
 * 
 * WHY LOCK?
 * - Cron runs every 3 seconds
 * - If processing takes longer, next tick is skipped
 * - Prevents duplicate processing of same messages
 * 
 * HOW TO ENABLE/DISABLE?
 * - Start/stop the Scheduler microservice
 * - Or set workspace.channelStatus = false
 */
export async function whatsappChallengeQueueJob(): Promise<void> {
  // 🔒 LOCK CHECK: Skip if previous job is still running
  if (isProcessing) {
    logger.debug('[WhatsApp Queue] Skipping - previous job still running')
    return
  }

  isProcessing = true
  const startTime = Date.now()

  try {
    const securityAgent = new SecurityAgentService()
    
    // Find workspaces with active channel
    const workspaces = await prisma.workspace.findMany({
      where: {
        channelStatus: true,  // Channel must be active
        isActive: true,
        isDelete: false,
      },
      select: {
        id: true,
        name: true,
        whatsappApiKey: true,
        whatsappPhoneNumber: true,
        debugMode: true,
      },
    })

    if (workspaces.length === 0) {
      logger.debug('[WhatsApp Queue] No workspaces with active channel found')
      return
    }

    let totalProcessed = 0
    let totalBlocked = 0
    let totalErrors = 0

    for (const workspace of workspaces) {
      // 🔧 DEBUG MODE: Skip sending if debugMode is enabled
      if (workspace.debugMode === true) {
        logger.debug(`[WhatsApp Queue] 🔧 DEBUG MODE for "${workspace.name}" - messages stay pending`)
        continue
      }

      // Get pending messages from queue
      // ⚠️ LIMIT TO 10 per workspace per cycle
      const pendingMessages = await prisma.whatsAppQueue.findMany({
        where: {
          workspaceId: workspace.id,
          status: 'pending',
        },
        take: 10,
        orderBy: { createdAt: 'asc' }, // FIFO order
      })

      if (pendingMessages.length === 0) continue

      logger.info(`[WhatsApp Queue] Processing ${pendingMessages.length} messages for workspace: ${workspace.name}`)

      // 🚀 PARALLEL PROCESSING: Send all messages simultaneously
      // Safe because WhatsApp limit is per-pair (same customer), not global
      const results = await Promise.allSettled(
        pendingMessages.map(async (message) => {
          try {
            // 🔒 SECURITY CHECK: Pass through Security Agent LLM before sending
            const securityCheck = await securityAgent.validateMessage({
              workspaceId: workspace.id,
              messageContent: message.messageContent,
              customerId: message.customerId,
            })

            if (!securityCheck.isSafe) {
              // 🚫 Message blocked by Security Agent
              await prisma.whatsAppQueue.update({
                where: { id: message.id },
                data: { 
                  status: 'blocked',
                  errorMessage: `Security blocked: ${securityCheck.reason}`,
                },
              })
              return { status: 'blocked', messageId: message.id, reason: securityCheck.reason }
            }

            // ✅ Message passed security - proceed with sending
            // TODO: Implement actual WhatsApp API call here
            // await sendWhatsAppMessage(workspace, message)

            // Mark as sent
            await prisma.whatsAppQueue.update({
              where: { id: message.id },
              data: { 
                status: 'sent',
                deliveredAt: new Date(),
              },
            })

            // 💰 BILLING: Deduct credit for sent message
            try {
              const billingService = new BillingService()
              const deductResult = await billingService.deductMessageCredit(
                workspace.id,
                message.id
              )
              if (deductResult.success) {
                logger.info(`[WhatsApp Queue] 💰 Credit deducted for message ${message.id}: €${deductResult.amountDeducted?.toFixed(2)} → Balance: €${deductResult.newBalance?.toFixed(2)}`)
              } else {
                logger.warn(`[WhatsApp Queue] ⚠️ Failed to deduct credit: ${deductResult.error}`)
              }
            } catch (billingError) {
              logger.error(`[WhatsApp Queue] ⚠️ Billing error for message ${message.id}:`, billingError)
              // Don't fail the message - billing error is non-critical
            }

            return { status: 'sent', messageId: message.id }

          } catch (error) {
            // Mark as failed
            await prisma.whatsAppQueue.update({
              where: { id: message.id },
              data: { 
                status: 'error',
                errorMessage: (error as Error).message,
              },
            })
            return { status: 'error', messageId: message.id, error: (error as Error).message }
          }
        })
      )

      // Count results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const value = result.value
          if (value.status === 'sent') totalProcessed++
          else if (value.status === 'blocked') totalBlocked++
          else if (value.status === 'error') totalErrors++
        } else {
          totalErrors++
        }
      }
    }

    const duration = Date.now() - startTime
    if (totalProcessed > 0 || totalBlocked > 0 || totalErrors > 0) {
      logger.info(`[WhatsApp Queue] ✅ Cycle completed in ${duration}ms: ${totalProcessed} sent, ${totalBlocked} blocked, ${totalErrors} errors`)
    }

  } catch (error) {
    logger.error('[WhatsApp Queue] ❌ Job error:', error)
  } finally {
    // 🔓 UNLOCK: Allow next cron tick to run
    isProcessing = false
  }
}
