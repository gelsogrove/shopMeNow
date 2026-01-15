import {
  prisma,
  PrismaClient,
  SupportTicket,
  SupportMessage,
  SupportAttachment,
  SupportIssueType,
  SupportTicketStatus,
  SupportSenderType,
} from "@echatbot/database"
import logger from "../utils/logger"

export interface CreateTicketData {
  userId: string
  workspaceId?: string // Optional - user may not have a workspace
  issueType: SupportIssueType
  subject: string
  initialMessage: string
  createdById?: string
  createdByType?: SupportSenderType
}

export interface CreateMessageData {
  ticketId: string
  senderId: string
  senderType: SupportSenderType
  content: string
}

export interface CreateAttachmentData {
  messageId: string
  filename: string
  url: string
  storageKey: string
  mimeType: string
  size: number
}

export interface TicketFilters {
  userId?: string
  workspaceId?: string
  status?: SupportTicketStatus
  issueType?: SupportIssueType
  page?: number
  limit?: number
}

export interface PaginatedTickets {
  tickets: SupportTicketWithDetails[]
  total: number
  page: number
  totalPages: number
}

export interface SupportTicketWithDetails extends SupportTicket {
  user: { id: string; email: string; firstName: string | null; lastName: string | null }
  workspace: { id: string; name: string } | null // Optional workspace
  messages: SupportMessageWithAttachments[]
  _count: { messages: number }
}

export interface SupportMessageWithAttachments extends SupportMessage {
  attachments: SupportAttachment[]
}

export class SupportTicketRepository {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  /**
   * Generate unique ticket code: TKT-XXXXXX
   */
  private async generateTicketCode(): Promise<string> {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code: string
    let exists = true

    while (exists) {
      const random = Array.from({ length: 6 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join("")
      code = `TKT-${random}`

      const existing = await this.prisma.supportTicket.findUnique({
        where: { ticketCode: code },
      })
      exists = !!existing
    }

    return code!
  }

  /**
   * Create a new support ticket with initial message
   */
  async create(data: CreateTicketData): Promise<SupportTicketWithDetails> {
    const ticketCode = await this.generateTicketCode()
    const senderId = data.createdById || data.userId
    const senderType = data.createdByType || SupportSenderType.CUSTOMER

    // Build data object conditionally - Prisma doesn't accept undefined for optional relations
    const createData: any = {
      ticketCode,
      user: { connect: { id: data.userId } },
      issueType: data.issueType,
      subject: data.subject,
      messages: {
        create: {
          senderId,
          senderType,
          content: data.initialMessage,
        },
      },
    }

    // Only add workspace connection if workspaceId is provided
    if (data.workspaceId) {
      createData.workspace = { connect: { id: data.workspaceId } }
    }

    const ticket = await this.prisma.supportTicket.create({
      data: createData,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
        messages: {
          include: { attachments: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { messages: true } },
      },
    })

    logger.info(`Created support ticket ${ticketCode}`, {
      ticketId: ticket.id,
      userId: data.userId,
      issueType: data.issueType,
    })

    return ticket
  }

  /**
   * Find ticket by ID with all messages
   */
  async findById(id: string): Promise<SupportTicketWithDetails | null> {
    return this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
        messages: {
          include: { attachments: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { messages: true } },
      },
    })
  }

  /**
   * Find ticket by code (TKT-XXXXXX)
   */
  async findByCode(ticketCode: string): Promise<SupportTicketWithDetails | null> {
    return this.prisma.supportTicket.findUnique({
      where: { ticketCode },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
        messages: {
          include: { attachments: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { messages: true } },
      },
    })
  }

  /**
   * Find all tickets with filters (for owner or admin)
   */
  async findAll(filters: TicketFilters): Promise<PaginatedTickets> {
    const where: any = {}

    if (filters.userId) {
      where.userId = filters.userId
    }

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId
    }

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.issueType) {
      where.issueType = filters.issueType
    }

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          workspace: {
            select: { id: true, name: true },
          },
          messages: {
            include: { attachments: true },
            orderBy: { createdAt: "desc" },
            take: 1, // Only latest message for list view
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ])

    return {
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Add a message to a ticket
   */
  async addMessage(data: CreateMessageData): Promise<SupportMessageWithAttachments> {
    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId: data.ticketId,
        senderId: data.senderId,
        senderType: data.senderType,
        content: data.content,
      },
      include: { attachments: true },
    })

    // Update ticket timestamp
    await this.prisma.supportTicket.update({
      where: { id: data.ticketId },
      data: { updatedAt: new Date() },
    })

    logger.info(`Added message to ticket`, {
      ticketId: data.ticketId,
      messageId: message.id,
      senderType: data.senderType,
    })

    return message
  }

  /**
   * Add attachment to a message
   */
  async addAttachment(data: CreateAttachmentData): Promise<SupportAttachment> {
    const attachment = await this.prisma.supportAttachment.create({
      data: {
        messageId: data.messageId,
        filename: data.filename,
        url: data.url,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        size: data.size,
      },
    })

    logger.info(`Added attachment to message`, {
      messageId: data.messageId,
      attachmentId: attachment.id,
      filename: data.filename,
    })

    return attachment
  }

  /**
   * Update ticket status
   */
  async updateStatus(
    id: string,
    status: SupportTicketStatus
  ): Promise<SupportTicketWithDetails | null> {
    const data: any = { status }

    if (status === SupportTicketStatus.CLOSED) {
      data.closedAt = new Date()
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        workspace: {
          select: { id: true, name: true },
        },
        messages: {
          include: { attachments: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { messages: true } },
      },
    })

    logger.info(`Updated ticket status`, {
      ticketId: id,
      newStatus: status,
    })

    return ticket
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(ticketId: string, senderType: SupportSenderType): Promise<void> {
    // Mark messages from the OTHER sender type as read
    const targetSenderType =
      senderType === SupportSenderType.CUSTOMER
        ? SupportSenderType.ADMIN
        : SupportSenderType.CUSTOMER

    await this.prisma.supportMessage.updateMany({
      where: {
        ticketId,
        senderType: targetSenderType,
        isRead: false,
      },
      data: { isRead: true },
    })
  }

  /**
   * Count unread messages for a user
   */
  async countUnreadMessages(userId: string): Promise<number> {
    // Count unread ADMIN messages for tickets owned by this user
    return this.prisma.supportMessage.count({
      where: {
        ticket: { userId },
        senderType: SupportSenderType.ADMIN,
        isRead: false,
      },
    })
  }

  /**
   * Count unread messages for admin (all CUSTOMER messages)
   */
  async countUnreadMessagesForAdmin(): Promise<number> {
    return this.prisma.supportMessage.count({
      where: {
        senderType: SupportSenderType.CUSTOMER,
        isRead: false,
      },
    })
  }

  /**
   * Get all attachments for cleanup (closed tickets older than X days)
   */
  async getAttachmentsForCleanup(daysOld: number): Promise<SupportAttachment[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    return this.prisma.supportAttachment.findMany({
      where: {
        message: {
          ticket: {
            status: SupportTicketStatus.CLOSED,
            closedAt: { lt: cutoffDate },
          },
        },
      },
    })
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(id: string): Promise<void> {
    await this.prisma.supportAttachment.delete({
      where: { id },
    })
  }

  /**
   * Delete ticket (hard delete)
   */
  async deleteTicket(id: string): Promise<SupportTicket> {
    return this.prisma.supportTicket.delete({
      where: { id },
    })
  }
}

export const supportTicketRepository = new SupportTicketRepository()
