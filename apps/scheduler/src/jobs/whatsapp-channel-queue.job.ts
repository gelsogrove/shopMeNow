import { prisma } from '../config/database'
import logger from '../utils/logger'
import { SecurityAgentService } from '../services/security-agent.service'
import { BillingService } from '../services/billing.service'
import { getWorkspaceWhatsAppConfig, WorkspaceWhatsAppConfig } from '../services/whatsapp-config.service'

const MAX_DEBUG_STEPS = 50
const RECIPIENT_COOLDOWN_MS = 6000 // WhatsApp limit ~1 msg / 6s per recipient
const recipientSendTimestamps = new Map<string, number>()

// Exposed for tests to reset throttle cache between runs
export function clearRecipientThrottleCache(): void {
  recipientSendTimestamps.clear()
}

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
    if (debugInfo.steps.length > MAX_DEBUG_STEPS) {
      debugInfo.steps = debugInfo.steps.slice(-MAX_DEBUG_STEPS)
    }

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

async function isWipConversationMessage(conversationMessageId: string | null | undefined): Promise<boolean> {
  if (!conversationMessageId) {
    return false
  }

  const conversationMessage = await prisma.conversationMessage.findUnique({
    where: { id: conversationMessageId },
    select: { debugInfo: true },
  })

  const debugInfo = conversationMessage?.debugInfo
  if (!debugInfo) return false
  try {
    const parsed = JSON.parse(debugInfo)
    return Boolean(parsed?.channelDisabled)
  } catch {
    return false
  }
}

interface WhatsAppSendParams {
  config: WorkspaceWhatsAppConfig
  to: string
  message: string
}

async function sendWhatsAppMessage(params: WhatsAppSendParams): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const { config, to, message } = params
  const apiUrl = `https://graph.facebook.com/v18.0/${config.phoneNumber}/messages`

  const attemptSend = async (): Promise<{ success: boolean; status?: number; error?: string; messageId?: string }> => {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^\+/, ''),
        type: 'text',
        text: { body: message },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[WhatsApp Queue] WhatsApp API error ${response.status}: ${errorText}`)
      return { success: false, status: response.status, error: `WhatsApp API error: ${response.status}` }
    }

    const data = (await response.json().catch(() => ({}))) as any
    const messageId = data?.messages?.[0]?.id
    return { success: true, messageId }
  }

  try {
    const first = await attemptSend()
    if (first.success) return first

    // Retry once for transient errors (5xx / 429)
    if (first.status && (first.status >= 500 || first.status === 429)) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const second = await attemptSend()
      return second
    }

    return first
  } catch (error: any) {
    logger.error('[WhatsApp Queue] Error calling WhatsApp API', error)
    return { success: false, error: error?.message || 'WhatsApp send failed' }
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
 * - Or set workspace.debugMode = true (test mode)
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
    const billingService = new BillingService()
    
    // Find workspaces with active channel or WIP-only delivery modes
    const workspaces = await prisma.workspace.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        whatsappApiKey: true,
        whatsappPhoneNumber: true,
        channelStatus: true,
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
      const wipOnly = workspace.debugMode === true || workspace.channelStatus === false
      
      logger.info(`[WhatsApp Queue] 📬 Processing workspace "${workspace.name}" (${workspace.id})`, {
        debugMode: workspace.debugMode,
        channelStatus: workspace.channelStatus,
        wipOnly,
      })

      // Load WhatsApp credentials/config for this workspace
      const workspaceWhatsAppConfig = await getWorkspaceWhatsAppConfig(workspace.id)

      // Get pending messages from queue (excluding playground messages)
      // ⚠️ LIMIT TO 10 per workspace per cycle
      const pendingMessages = await prisma.whatsAppQueue.findMany({
        where: {
          workspaceId: workspace.id,
          status: 'pending',
          // Skip widget messages: handled synchronously without queue
          channel: { not: 'widget' },
        },
        take: 10,
        orderBy: { createdAt: 'asc' }, // FIFO order
      })

      if (pendingMessages.length === 0) continue

      logger.info(`[WhatsApp Queue] Processing ${pendingMessages.length} messages for workspace: ${workspace.name}`)

      let workspaceProcessed = 0
      let workspaceBlocked = 0
      let workspaceErrors = 0

      for (const message of pendingMessages) {
        const markQueue = async (status: 'blocked' | 'error', errorMessage: string) => {
          await prisma.whatsAppQueue.update({
            where: { id: message.id },
            data: {
              status,
              errorMessage,
            },
          })
          if (message.conversationMessageId) {
            await prisma.conversationMessage.update({
              where: { id: message.conversationMessageId },
              data: { deliveryStatus: status },
            })
          }
        }

        try {
          let isWipMessage = false
          if (wipOnly) {
            isWipMessage = await isWipConversationMessage(message.conversationMessageId)

            if (!isWipMessage) {
              logger.info('[WhatsApp Queue] WIP-only mode - skipping non-WIP message', {
                queueId: message.id,
                workspaceId: workspace.id,
              })
              workspaceBlocked++
              continue
            }
          }

          const hasCredit = await billingService.hasOwnerCredit(workspace.id)
          if (!hasCredit) {
            await markQueue('error', 'Subscription inactive or insufficient credit')
            workspaceErrors++
            continue
          }

          // 🔒 SECURITY CHECK: Pass through Security Agent LLM before sending
          const securityCheck = await securityAgent.validateMessage({
            workspaceId: workspace.id,
            messageContent: message.messageContent,
            customerId: message.customerId,
          })

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
            await markQueue('blocked', `Security blocked: ${securityCheck.reason}`)
            workspaceBlocked++
            continue
          }

          // ✅ Message passed security - proceed with delivery
          const deliveryStartTime = Date.now()
          let deliveryNote: string | undefined
          
          // 🔀 CHANNEL-SPECIFIC DELIVERY
          if (message.channel === 'widget') {
            // Widget: Save response to queue (no API call)
            // Frontend will poll for this response
            await prisma.whatsAppQueue.update({
              where: { id: message.id },
              data: { 
                status: 'sent',
                deliveredAt: new Date(),
                responsePayload: {
                  response: message.messageContent, // LLM response already in messageContent
                  processedAt: new Date().toISOString(),
                },
              },
            })
            
            logger.info(`✅ Widget message delivered (response saved for polling)`, {
              messageId: message.id,
              visitorId: message.visitorId,
            })
            deliveryNote = `✅ Response saved for polling by visitor ${message.visitorId}`
          } else {
            // WhatsApp: Send via API
            if (!workspaceWhatsAppConfig) {
              await markQueue('error', 'WhatsApp not configured for this workspace')
              workspaceErrors++
              continue
            }

            if (!message.phoneNumber) {
              await markQueue('error', 'Missing destination phone number')
              workspaceErrors++
              continue
            }

            const lastSendTs = recipientSendTimestamps.get(message.phoneNumber)
            const nowTs = Date.now()
            if (lastSendTs && nowTs - lastSendTs < RECIPIENT_COOLDOWN_MS) {
              logger.info(`[WhatsApp Queue] Throttling recipient ${message.phoneNumber} - sent ${nowTs - lastSendTs}ms ago`)
              continue
            }

            const sendResult = await sendWhatsAppMessage({
              config: workspaceWhatsAppConfig,
              to: message.phoneNumber,
              message: message.messageContent,
            })

            if (!sendResult.success) {
              await markQueue('error', sendResult.error || 'WhatsApp send failed')
              workspaceErrors++
              continue
            }

            recipientSendTimestamps.set(message.phoneNumber, Date.now())

            await prisma.whatsAppQueue.update({
              where: { id: message.id },
              data: { 
                status: 'sent',
                deliveredAt: new Date(),
              },
            })
            deliveryNote = `✅ Message delivered to ${message.phoneNumber}${sendResult.messageId ? ` (waId: ${sendResult.messageId})` : ''}`
          }
          
          const deliveryDuration = Date.now() - deliveryStartTime

          // 📊 Append delivery step to timeline
          const deliveryTimestamp = new Date()
          await appendTimelineStep(message.conversationMessageId, {
            type: 'sub_agent',
            agent: message.channel === 'widget' ? 'Widget Delivery' : 'Send to WhatsApp',
            timestamp: deliveryTimestamp.toISOString(),
            model: message.channel === 'widget' ? 'Widget Polling System' : 'WhatsApp Cloud API',
            input: {
              phoneNumber: message.phoneNumber || undefined,
              messageContent: message.messageContent.substring(0, 200) + (message.messageContent.length > 200 ? '...' : ''),
              queueId: message.id,
            },
            output: {
              textResponse: message.channel === 'widget' 
                ? `✅ Response saved for polling by visitor ${message.visitorId}\n\n${message.messageContent}`
                : `${deliveryNote || '✅ Message delivered to WhatsApp'}\n\n${message.messageContent}`,
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

          if (!isWipMessage) {
            // 💰 BILLING: Deduct credit for sent message (sequential to avoid double-spend)
            const deductResult = await billingService.deductMessageCredit(
              workspace.id,
              message.id
            )
            if (deductResult.success) {
              logger.info(`[WhatsApp Queue] 💰 Credit deducted for message ${message.id}: €${deductResult.amountDeducted?.toFixed(2)} → Balance: €${deductResult.newBalance?.toFixed(2)}`)
            } else {
              await markQueue('error', `Billing failed: ${deductResult.error}`)
              workspaceErrors++
              continue
            }
          }

          workspaceProcessed++

        } catch (error) {
          await markQueue('error', (error as Error).message)
          workspaceErrors++
        }
      }

      totalProcessed += workspaceProcessed
      totalBlocked += workspaceBlocked
      totalErrors += workspaceErrors
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
