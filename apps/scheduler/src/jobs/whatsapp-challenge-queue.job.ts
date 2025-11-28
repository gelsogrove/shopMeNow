import { prisma } from '../config/database'
import logger from '../utils/logger'
import { SecurityAgentService } from '../services/security-agent.service'

/**
 * WhatsApp Challenge Queue Job
 * Runs every 3 minutes
 * Processes pending messages for workspaces with active channel
 * 
 * CRITICAL: All messages pass through Security Agent LLM before sending
 */
export async function whatsappChallengeQueueJob(): Promise<void> {
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
    },
  })

  if (workspaces.length === 0) {
    logger.info('No workspaces with active channel found')
    return
  }

  let totalProcessed = 0
  let totalBlocked = 0

  for (const workspace of workspaces) {
    // Get pending messages from queue
    const pendingMessages = await prisma.whatsAppQueue.findMany({
      where: {
        workspaceId: workspace.id,
        status: 'pending', // lowercase as per schema
      },
      take: 50, // Process max 50 per run
      orderBy: { createdAt: 'asc' },
    })

    if (pendingMessages.length === 0) continue

    logger.info(`Processing ${pendingMessages.length} messages for workspace: ${workspace.name}`)

    for (const message of pendingMessages) {
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
          totalBlocked++
          logger.warn(`🚫 Message ${message.id} blocked by Security Agent: ${securityCheck.reason}`)
          continue
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
        totalProcessed++

      } catch (error) {
        // Mark as failed
        await prisma.whatsAppQueue.update({
          where: { id: message.id },
          data: { 
            status: 'error',
            errorMessage: (error as Error).message,
          },
        })
        logger.error(`Failed to send message ${message.id}:`, error)
      }
    }
  }

  logger.info(`Queue processed: ${totalProcessed} sent, ${totalBlocked} blocked`)
}
