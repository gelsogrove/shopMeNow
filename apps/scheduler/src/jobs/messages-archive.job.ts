import { prisma } from '../config/database'
import logger from '../utils/logger'

// Archive messages older than 6 months
// Moves them to messages_archive table and deletes from messages
const ARCHIVE_AFTER_MONTHS = 6
const BATCH_SIZE = 1000 // Process in batches to avoid memory issues

export async function messagesArchiveJob(): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - ARCHIVE_AFTER_MONTHS)

  logger.info(`📦 Starting messages archive job (archiving before ${cutoffDate.toISOString()})`)

  let totalArchived = 0
  let hasMore = true

  while (hasMore) {
    // Find old messages with their session info (for denormalization)
    const oldMessages = await prisma.message.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
      include: {
        chatSession: {
          select: {
            workspaceId: true,
            customerId: true,
          },
        },
      },
      take: BATCH_SIZE,
    })

    if (oldMessages.length === 0) {
      hasMore = false
      break
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Insert into archive (ALL fields for complete restore)
      for (const msg of oldMessages) {
        if (!msg.chatSession) {
          logger.warn(`[MESSAGES_ARCHIVE] Missing chatSession for message ${msg.id}. Deleting without archive.`)
          await tx.message.delete({ where: { id: msg.id } })
          continue
        }
        await tx.messageArchive.create({
          data: {
            originalId: msg.id,
            direction: msg.direction,
            content: msg.content,
            type: msg.type,
            status: msg.status,
            aiGenerated: msg.aiGenerated,
            metadata: msg.metadata ?? undefined,
            read: msg.read,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
            chatSessionId: msg.chatSessionId,
            workspaceId: msg.chatSession.workspaceId,
            customerId: msg.chatSession.customerId,
            // Debug/processing fields
            functionCallsDebug: msg.functionCallsDebug ?? undefined,
            processingSource: msg.processingSource,
            translatedQuery: msg.translatedQuery,
            processedPrompt: msg.processedPrompt,
            debugInfo: msg.debugInfo ?? undefined,
            // WhatsApp fields
            whatsappStatus: msg.whatsappStatus,
            whatsappError: msg.whatsappError,
            whatsappMessageId: msg.whatsappMessageId,
            sentBy: msg.sentBy,
          },
        })
      }

      // 2. Delete from messages
      await tx.message.deleteMany({
        where: {
          id: {
            in: oldMessages.map((m) => m.id),
          },
        },
      })
    })

    totalArchived += oldMessages.length
    logger.info(`📦 Archived batch: ${oldMessages.length} messages (total: ${totalArchived})`)

    // If we got less than batch size, we're done
    if (oldMessages.length < BATCH_SIZE) {
      hasMore = false
    }
  }

  if (totalArchived > 0) {
    logger.info(`✅ Messages archive completed: ${totalArchived} messages archived`)
  } else {
    logger.info(`✅ No messages to archive (all messages are newer than ${ARCHIVE_AFTER_MONTHS} months)`)
  }
}
