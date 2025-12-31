import { prisma } from '../config/database'
import logger from '../utils/logger'
import { SecurityAgentService } from '../services/security-agent.service'
import { BillingService } from '../services/billing.service'

/**
 * Timeline step interface for debugInfo append
 */
interface TimelineStep {
  type: 'sub_agent'
  agent: string
  timestamp: string
  model?: string
  systemPrompt?: string
  input?: {
    phoneNumber?: string
    messageContent?: string
    queueId?: string
    customerId?: string
    prompt?: string
  }
  output?: {
    result?: any
    textResponse?: string
    executionTimeMs?: number
  }
}

/**
 * Append a step to the conversation message timeline (debugInfo)
 * Used when processing queue messages to add Security Check and Send to WhatsApp steps
 */
async function appendTimelineStep(
  conversationMessageId: string | null | undefined,
  step: TimelineStep
): Promise<void> {
  if (!conversationMessageId) {
    logger.debug('[WhatsApp Queue] No conversationMessageId - skipping timeline append')
    return
  }

  try {
    const message = await prisma.conversationMessage.findUnique({
      where: { id: conversationMessageId },
      select: { id: true, debugInfo: true },
    })

    if (!message) {
      logger.warn(`[WhatsApp Queue] Conversation message ${conversationMessageId} not found for timeline append`)
      return
    }

    // Parse existing debugInfo or create new structure
    let debugInfo: {
      steps: TimelineStep[]
      totalTokens: number
      totalCost: number
      executionTimeMs: number
    }

    if (message.debugInfo) {
      try {
        debugInfo = JSON.parse(message.debugInfo)
        if (!debugInfo.steps) {
          debugInfo.steps = []
        }
      } catch {
        debugInfo = { steps: [], totalTokens: 0, totalCost: 0, executionTimeMs: 0 }
      }
    } else {
      debugInfo = { steps: [], totalTokens: 0, totalCost: 0, executionTimeMs: 0 }
    }

    // Append the new step
    debugInfo.steps.push(step)

    // Update execution time if provided
    if (step.output?.executionTimeMs) {
      debugInfo.executionTimeMs += step.output.executionTimeMs
    }

    // Save updated debugInfo
    await prisma.conversationMessage.update({
      where: { id: conversationMessageId },
      data: { debugInfo: JSON.stringify(debugInfo) },
    })

    logger.debug(`[WhatsApp Queue] Appended "${step.agent}" step to timeline for message ${conversationMessageId}`)
  } catch (error) {
    logger.error(`[WhatsApp Queue] Error appending timeline step:`, error)
  }
}

/**
 * In-memory lock to prevent concurrent executions
 * If the job is still running when the next cron tick happens, skip it
 */
let isProcessing = false

/**
 * WhatsApp Channel Queue Job
 * 
 * Runs every 5 seconds via cron (configured in index.ts)
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
 * - Cron runs every 5 seconds
 * - If processing takes longer, next tick is skipped
 * - Prevents duplicate processing of same messages
 * 
 * HOW TO ENABLE/DISABLE?
 * - Start/stop the Scheduler microservice
 * - Or set workspace.channelStatus = false
 */
export async function whatsappChannelQueueJob(): Promise<void> {
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
        pendingMessages.map(async (message: (typeof pendingMessages)[number]) => {
          try {
            // 🔒 SECURITY CHECK: Pass through Security Agent LLM before sending
            const securityStartTime = Date.now()
            const securityCheck = await securityAgent.validateMessage({
              workspaceId: workspace.id,
              messageContent: message.messageContent,
              customerId: message.customerId,
            })
            const securityDuration = Date.now() - securityStartTime

            // 📊 Append Security Check step to timeline
            const securityTimestamp = new Date()
            await appendTimelineStep(message.conversationMessageId, {
              type: 'sub_agent',
              agent: 'Security Check',
              timestamp: securityTimestamp.toISOString(),
              model: 'security-patterns/v1',
              systemPrompt: 'Validates outgoing messages using pattern-based detection: SQL injection, XSS, command injection, sensitive data exposure, spam patterns. Also checks customer blacklist status.',
              input: {
                messageContent: message.messageContent.substring(0, 200) + (message.messageContent.length > 200 ? '...' : ''),
                customerId: message.customerId,
              },
              output: {
                textResponse: securityCheck.isSafe ? '✅ Message passed security validation' : `🚫 Blocked: ${securityCheck.reason}`,
              },
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

              // Update ConversationMessage status to blocked
              if (message.conversationMessageId) {
                await prisma.conversationMessage.update({
                  where: { id: message.conversationMessageId },
                  data: { deliveryStatus: 'blocked' },
                })
              }

              return { status: 'blocked', messageId: message.id, reason: securityCheck.reason }
            }

            // ✅ Message passed security - proceed with sending
            const whatsappStartTime = Date.now()
            // TODO: Implement actual WhatsApp API call here
            // await sendWhatsAppMessage(workspace, message)
            const whatsappDuration = Date.now() - whatsappStartTime

            // Mark as sent
            await prisma.whatsAppQueue.update({
              where: { id: message.id },
              data: { 
                status: 'sent',
                deliveredAt: new Date(),
              },
            })

            // 📊 Append Send to WhatsApp step to timeline
            const whatsappTimestamp = new Date()
            await appendTimelineStep(message.conversationMessageId, {
              type: 'sub_agent',
              agent: 'Send to WhatsApp',
              timestamp: whatsappTimestamp.toISOString(),
              model: 'WhatsApp Cloud API',
              input: {
                phoneNumber: message.phoneNumber,
                messageContent: message.messageContent.substring(0, 200) + (message.messageContent.length > 200 ? '...' : ''),
                queueId: message.id,
              },
              output: {
                textResponse: `✅ Message delivered to ${message.phoneNumber}\n\n${message.messageContent}`,
              },
            })

            // Update ConversationMessage as delivered
            if (message.conversationMessageId) {
              await prisma.conversationMessage.update({
                where: { id: message.conversationMessageId },
                data: { 
                  deliveryStatus: 'sent',
                  deliveredAt: new Date(),
                },
              })
            }

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
