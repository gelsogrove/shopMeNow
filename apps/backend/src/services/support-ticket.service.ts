import {
  SupportIssueType,
  SupportTicketStatus,
  SupportSenderType,
} from "@echatbot/database"
import {
  supportTicketRepository,
  SupportTicketWithDetails,
  PaginatedTickets,
  SupportMessageWithAttachments,
} from "../repositories/support-ticket.repository"
import { storageService } from "./storage.service"
import { EmailService } from "../application/services/email.service"
import { websocketService } from "./websocket.service"
import logger from "../utils/logger"

// Email service instance
const emailService = new EmailService()

interface CreateTicketInput {
  userId: string
  workspaceId?: string // Optional - user may not have a workspace selected
  issueType: SupportIssueType
  subject: string
  initialMessage: string
  createdById?: string
  createdByType?: SupportSenderType
}

interface AddMessageInput {
  ticketId: string
  senderId: string
  senderType: SupportSenderType
  content: string
}

interface AttachmentFile {
  originalname: string
  buffer: Buffer
  mimetype: string
  size: number
}

export class SupportTicketService {
  /**
   * Create a new support ticket (owner only)
   */
  async createTicket(input: CreateTicketInput): Promise<SupportTicketWithDetails> {
    logger.info("Creating support ticket", {
      userId: input.userId,
      workspaceId: input.workspaceId,
      issueType: input.issueType,
      createdByType: input.createdByType || SupportSenderType.CUSTOMER,
    })

    const ticket = await supportTicketRepository.create({
      userId: input.userId,
      workspaceId: input.workspaceId,
      issueType: input.issueType,
      subject: input.subject,
      initialMessage: input.initialMessage,
      createdById: input.createdById,
      createdByType: input.createdByType,
    })

    // Send email notification to support team and owner
    try {
      const issueTypeLabels: Record<SupportIssueType, string> = {
        ACCOUNT_ISSUE: "Account Issue",
        PLAN_AND_BILLING: "Plan & Billing",
        WHATSAPP: "WhatsApp",
        WIDGET: "Widget",
        SALES_AGENT: "Sales Agent",
        SUPPORT: "Support Message",
        OTHER: "Other",
      }

      await emailService.sendSupportTicketCreatedEmail({
        ticketCode: ticket.ticketCode,
        subject: input.subject,
        issueType: issueTypeLabels[input.issueType] || input.issueType,
        ownerEmail: ticket.user.email,
        ownerName: ticket.user.firstName || ticket.user.email.split("@")[0],
        workspaceName: ticket.workspace?.name || "No workspace",
        initialMessage: input.initialMessage,
      })
    } catch (emailError) {
      logger.error("Failed to send support ticket email notification:", emailError)
      // Don't fail the ticket creation if email fails
    }

    // Notify admin via WebSocket
    try {
      const issueTypeLabels: Record<SupportIssueType, string> = {
        ACCOUNT_ISSUE: "Account Issue",
        PLAN_AND_BILLING: "Plan & Billing",
        WHATSAPP: "WhatsApp",
        WIDGET: "Widget",
        SALES_AGENT: "Sales Agent",
        SUPPORT: "Support Message",
        OTHER: "Other",
      }

      websocketService.notifyAdminNewSupportTicket({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        subject: input.subject,
        issueType: issueTypeLabels[input.issueType] || input.issueType,
        userEmail: ticket.user.email,
        workspaceName: ticket.workspace.name,
        timestamp: new Date().toISOString(),
      })
    } catch (wsError) {
      logger.error("Failed to notify admin via WebSocket:", wsError)
    }

    return ticket
  }

  /**
   * Get ticket by ID
   */
  async getTicket(id: string): Promise<SupportTicketWithDetails | null> {
    return supportTicketRepository.findById(id)
  }

  /**
   * Get ticket by code
   */
  async getTicketByCode(code: string): Promise<SupportTicketWithDetails | null> {
    return supportTicketRepository.findByCode(code)
  }

  /**
   * Get all tickets for a user (owner)
   */
  async getUserTickets(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: SupportTicketStatus,
    issueType?: SupportIssueType
  ): Promise<PaginatedTickets> {
    const result = await supportTicketRepository.findAll({
      userId,
      page,
      limit,
      status,
      issueType,
    })
    
    // Add hasUnreadMessages field for customer (checks for unread ADMIN messages)
    const ticketsWithUnread = result.tickets.map(ticket => ({
      ...ticket,
      hasUnreadMessages: ticket.messages.some(msg => 
        msg.senderType === "ADMIN" && !msg.isRead
      )
    }))
    
    return {
      ...result,
      tickets: ticketsWithUnread
    }
  }

  /**
   * Get all tickets (admin)
   */
  async getAllTickets(
    page: number = 1,
    limit: number = 20,
    status?: SupportTicketStatus,
    issueType?: SupportIssueType
  ): Promise<PaginatedTickets> {
    const result = await supportTicketRepository.findAll({
      page,
      limit,
      status,
      issueType,
    })
    
    // Add hasUnreadMessages field for admin (checks for unread CUSTOMER messages)
    const ticketsWithUnread = result.tickets.map(ticket => ({
      ...ticket,
      hasUnreadMessages: ticket.messages.some(msg => 
        msg.senderType === "CUSTOMER" && !msg.isRead
      )
    }))
    
    return {
      ...result,
      tickets: ticketsWithUnread
    }
  }

  /**
   * Add a message to a ticket
   */
  async addMessage(
    input: AddMessageInput,
    attachments?: AttachmentFile[]
  ): Promise<SupportMessageWithAttachments> {
    logger.info("Adding message to ticket", {
      ticketId: input.ticketId,
      senderType: input.senderType,
    })

    const message = await supportTicketRepository.addMessage({
      ticketId: input.ticketId,
      senderId: input.senderId,
      senderType: input.senderType,
      content: input.content,
    })

    // Upload attachments if any
    if (attachments && attachments.length > 0) {
      logger.info(`📎 Processing ${attachments.length} attachments for message ${message.id}`)
      for (const file of attachments) {
        try {
          logger.info(`📤 Uploading file: ${file.originalname} (${file.size} bytes, ${file.mimetype})`)
          // BUG#15 FIX: Sanitize originalname before using as storage path/filename.
          // Unsanitized names like "<script>alert(1)</script>.pdf" or "../../evil.sh"
          // would be stored verbatim in the DB and rendered in the admin UI → XSS,
          // and could cause unexpected behaviour in cloud storage key resolution.
          const safeOriginalname = file.originalname
            .replace(/[^a-zA-Z0-9._\-\s]/g, '_') // strip special chars
            .replace(/\.{2,}/g, '.')              // collapse consecutive dots (path traversal)
            .trim()
            .substring(0, 200)                   // hard cap on length

          const { url, key } = await storageService.upload(file.buffer, {
            filename: `${Date.now()}-${safeOriginalname}`,
            folder: `support-tickets/${input.ticketId}`,
            contentType: file.mimetype,
            isPublic: false,
          })
          logger.info(`✅ File uploaded: ${url}`)

          await supportTicketRepository.addAttachment({
            messageId: message.id,
            filename: safeOriginalname,
            url,
            storageKey: key,
            mimeType: file.mimetype,
            size: file.size,
          })
          logger.info(`✅ Attachment saved to DB`)
        } catch (error) {
          logger.error("Failed to upload attachment", { error, filename: file.originalname })
          console.error("ATTACHMENT UPLOAD ERROR:", error)
        }
      }

      // Reload message with attachments
      const ticket = await supportTicketRepository.findById(input.ticketId)
      const updatedMessage = ticket?.messages.find((m) => m.id === message.id)
      if (updatedMessage) {
        return updatedMessage
      }
    }

    // If admin replies, auto-transition to IN_PROGRESS and send email to owner
    if (input.senderType === SupportSenderType.ADMIN) {
      const ticket = await supportTicketRepository.findById(input.ticketId)
      if (ticket) {
        if (ticket.status === SupportTicketStatus.PENDING) {
          await supportTicketRepository.updateStatus(input.ticketId, SupportTicketStatus.IN_PROGRESS)
        }

        // Send email notification to owner
        try {
          await emailService.sendSupportTicketReplyEmail({
            ticketCode: ticket.ticketCode,
            subject: ticket.subject,
            ownerEmail: ticket.user.email,
            ownerName: ticket.user.firstName || ticket.user.email.split("@")[0],
            replyMessage: input.content,
          })
        } catch (emailError) {
          logger.error("Failed to send support ticket reply email:", emailError)
        }

        // Notify owner via WebSocket
        try {
          websocketService.notifySupportTicketMessage(ticket.userId, {
            ticketId: ticket.id,
            ticketCode: ticket.ticketCode,
            subject: ticket.subject,
            messagePreview: input.content.substring(0, 100),
            senderType: "ADMIN",
            timestamp: new Date().toISOString(),
          })
        } catch (wsError) {
          logger.error("Failed to notify owner via WebSocket:", wsError)
        }
      }
    }

    // If customer replies, notify admin
    if (input.senderType === SupportSenderType.CUSTOMER) {
      const ticket = await supportTicketRepository.findById(input.ticketId)
      if (ticket) {
        // Notify admin room via WebSocket
        try {
          websocketService.notifyAdminNewSupportTicket({
            ticketId: ticket.id,
            ticketCode: ticket.ticketCode,
            subject: ticket.subject,
            issueType: ticket.issueType,
            userEmail: ticket.user.email,
            workspaceName: ticket.workspace.name,
            timestamp: new Date().toISOString(),
          })
        } catch (wsError) {
          logger.error("Failed to notify admin via WebSocket:", wsError)
        }
      }
    }

    return message
  }

  /**
   * Update ticket status (admin only)
   */
  async updateStatus(
    ticketId: string,
    status: SupportTicketStatus
  ): Promise<SupportTicketWithDetails | null> {
    logger.info("Updating ticket status", { ticketId, status })

    const ticket = await supportTicketRepository.updateStatus(ticketId, status)

    // Send status change email for certain status transitions
    if (ticket && (status === SupportTicketStatus.IN_PROGRESS || status === SupportTicketStatus.CLOSED)) {
      try {
        await emailService.sendSupportTicketStatusChangeEmail({
          ticketCode: ticket.ticketCode,
          subject: ticket.subject,
          ownerEmail: ticket.user.email,
          ownerName: ticket.user.firstName || ticket.user.email.split("@")[0],
          newStatus: status,
        })
      } catch (emailError) {
        logger.error("Failed to send support ticket status change email:", emailError)
      }

      // Notify owner via WebSocket
      try {
        const oldStatus = status === SupportTicketStatus.IN_PROGRESS ? "PENDING" : "IN_PROGRESS"
        websocketService.notifySupportTicketStatusChange(ticket.userId, {
          ticketId: ticket.id,
          ticketCode: ticket.ticketCode,
          subject: ticket.subject,
          oldStatus,
          newStatus: status,
          timestamp: new Date().toISOString(),
        })
      } catch (wsError) {
        logger.error("Failed to notify owner of status change via WebSocket:", wsError)
      }
    }

    return ticket
  }

  /**
   * Mark messages as read
   */
  async markAsRead(ticketId: string, senderType: SupportSenderType): Promise<void> {
    await supportTicketRepository.markMessagesAsRead(ticketId, senderType)
  }

  /**
   * Count unread messages for a user
   */
  async countUnreadMessages(userId: string): Promise<number> {
    return supportTicketRepository.countUnreadMessages(userId)
  }

  /**
   * Count unread messages for admin
   */
  async countUnreadMessagesForAdmin(): Promise<number> {
    return supportTicketRepository.countUnreadMessagesForAdmin()
  }

  /**
   * Verify user owns the ticket
   */
  async verifyTicketOwnership(ticketId: string, userId: string): Promise<boolean> {
    const ticket = await supportTicketRepository.findById(ticketId)
    return ticket?.userId === userId
  }

  /**
   * Cleanup old attachments (for scheduler)
   */
  async cleanupOldAttachments(daysOld: number = 90): Promise<number> {
    logger.info(`Cleaning up support ticket attachments older than ${daysOld} days`)

    const attachments = await supportTicketRepository.getAttachmentsForCleanup(daysOld)
    let deletedCount = 0

    for (const attachment of attachments) {
      try {
        // Delete from storage
        await storageService.delete(attachment.storageKey)

        // Delete from database
        await supportTicketRepository.deleteAttachment(attachment.id)

        deletedCount++
      } catch (error) {
        logger.error("Failed to delete attachment", {
          attachmentId: attachment.id,
          error,
        })
      }
    }

    logger.info(`Cleaned up ${deletedCount} old support ticket attachments`)
    return deletedCount
  }

  /**
   * Delete ticket and attachments
   */
  async deleteTicket(ticketId: string): Promise<{ id: string; ticketCode: string } | null> {
    const ticket = await supportTicketRepository.findById(ticketId)
    if (!ticket) {
      return null
    }

    const attachments = ticket.messages.flatMap((message) => message.attachments || [])
    for (const attachment of attachments) {
      try {
        await storageService.delete(attachment.storageKey)
      } catch (error) {
        logger.warn("Failed to delete attachment from storage", {
          attachmentId: attachment.id,
          storageKey: attachment.storageKey,
          error,
        })
      }
    }

    await supportTicketRepository.deleteTicket(ticketId)
    return { id: ticket.id, ticketCode: ticket.ticketCode }
  }
}

export const supportTicketService = new SupportTicketService()
