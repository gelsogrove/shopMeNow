import { Request, Response } from "express"
import {
  prisma,
  SupportIssueType,
  SupportTicketStatus,
  SupportSenderType,
} from "@echatbot/database"
import { supportTicketService } from "../../../services/support-ticket.service"
import logger from "../../../utils/logger"

// Use Express Request with JwtPayload user type from auth middleware
type AuthenticatedRequest = Request

/**
 * Helper to check if user is platform admin
 * Checks req.user first, falls back to database if not set
 */
async function checkIsPlatformAdmin(req: AuthenticatedRequest): Promise<boolean> {
  const userId = (req as any).user?.id || (req as any).user?.userId
  let isPlatformAdmin = (req as any).user?.isPlatformAdmin
  
  // If isPlatformAdmin is not in token, check database directly
  if (isPlatformAdmin === undefined && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true }
    })
    isPlatformAdmin = user?.isPlatformAdmin || false
    logger.info(`🔍 Fetched isPlatformAdmin from DB: ${isPlatformAdmin} for user ${userId}`)
  }
  
  return isPlatformAdmin || false
}

/**
 * Support Ticket Controller
 * Handles support ticket CRUD operations for owners and admins
 */
export class SupportTicketController {
  /**
   * Create a new support ticket
   * POST /api/support/tickets
   * Body: { workspaceId (optional), issueType, subject, message }
   */
  async createTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return
      }

      const { workspaceId, issueType, subject, message } = req.body

      // workspaceId is now optional
      if (!issueType || !subject || !message) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: issueType, subject, message",
        })
        return
      }

      // Validate issue type
      if (!Object.values(SupportIssueType).includes(issueType)) {
        res.status(400).json({
          success: false,
          error: `Invalid issue type. Must be one of: ${Object.values(SupportIssueType).join(", ")}`,
        })
        return
      }

      const ticket = await supportTicketService.createTicket({
        userId,
        workspaceId: workspaceId || undefined, // Optional
        issueType,
        subject,
        initialMessage: message,
      })

      res.status(201).json({
        success: true,
        data: ticket,
      })
    } catch (error) {
      logger.error("Error creating support ticket:", error)
      console.error("SUPPORT TICKET ERROR DETAILS:", error)
      res.status(500).json({
        success: false,
        error: "Failed to create support ticket",
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Get all tickets for current user
   * GET /api/support/tickets
   * Query: page, limit, status, issueType
   */
  async getMyTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const status = req.query.status as SupportTicketStatus | undefined
      const issueType = req.query.issueType as SupportIssueType | undefined

      const result = await supportTicketService.getUserTickets(
        userId,
        page,
        limit,
        status,
        issueType
      )

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error("Error getting user tickets:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get tickets",
      })
    }
  }

  /**
   * Get a specific ticket by ID
   * GET /api/support/tickets/:ticketId
   */
  async getTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id
      const isPlatformAdmin = await checkIsPlatformAdmin(req)
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return
      }

      const { ticketId } = req.params

      const ticket = await supportTicketService.getTicket(ticketId)

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: "Ticket not found",
        })
        return
      }

      // Check ownership (unless admin)
      if (!isPlatformAdmin && ticket.userId !== userId) {
        res.status(403).json({
          success: false,
          error: "You do not have permission to view this ticket",
        })
        return
      }

      // Mark messages as read
      const senderType = isPlatformAdmin
        ? SupportSenderType.ADMIN
        : SupportSenderType.CUSTOMER
      await supportTicketService.markAsRead(ticketId, senderType)

      res.json({
        success: true,
        data: ticket,
      })
    } catch (error) {
      logger.error("Error getting ticket:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get ticket",
      })
    }
  }

  /**
   * Add a message to a ticket
   * POST /api/support/tickets/:ticketId/messages
   * Body: { message }
   */
  async addMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id
      const isPlatformAdmin = await checkIsPlatformAdmin(req)
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return
      }

      const { ticketId } = req.params
      const { message } = req.body

      if (!message) {
        res.status(400).json({
          success: false,
          error: "Message is required",
        })
        return
      }

      // Check ownership (unless admin)
      if (!isPlatformAdmin) {
        const isOwner = await supportTicketService.verifyTicketOwnership(ticketId, userId)
        if (!isOwner) {
          res.status(403).json({
            success: false,
            error: "You do not have permission to add messages to this ticket",
          })
          return
        }
      }

      const senderType = isPlatformAdmin
        ? SupportSenderType.ADMIN
        : SupportSenderType.CUSTOMER

      // Handle file attachments from multer
      const files = req.files as Express.Multer.File[] | undefined
      logger.info(`📎 Received ${files?.length || 0} files in addMessage request`)
      if (files && files.length > 0) {
        files.forEach((f, i) => logger.info(`  File ${i + 1}: ${f.originalname} (${f.size} bytes)`))
      }
      const attachments = files?.map((file) => ({
        originalname: file.originalname,
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
      }))

      const newMessage = await supportTicketService.addMessage(
        {
          ticketId,
          senderId: userId,
          senderType,
          content: message,
        },
        attachments
      )

      res.status(201).json({
        success: true,
        data: newMessage,
      })
    } catch (error) {
      logger.error("Error adding message:", error)
      res.status(500).json({
        success: false,
        error: "Failed to add message",
      })
    }
  }

  /**
   * Update ticket status (admin only)
   * PUT /api/support/tickets/:ticketId/status
   * Body: { status }
   */
  async updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const isPlatformAdmin = await checkIsPlatformAdmin(req)
      if (!isPlatformAdmin) {
        res.status(403).json({
          success: false,
          error: "Only platform admins can update ticket status",
        })
        return
      }

      const { ticketId } = req.params
      const { status } = req.body

      if (!status || !Object.values(SupportTicketStatus).includes(status)) {
        res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${Object.values(SupportTicketStatus).join(", ")}`,
        })
        return
      }

      const ticket = await supportTicketService.updateStatus(ticketId, status)

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: "Ticket not found",
        })
        return
      }

      res.json({
        success: true,
        data: ticket,
      })
    } catch (error) {
      logger.error("Error updating ticket status:", error)
      res.status(500).json({
        success: false,
        error: "Failed to update ticket status",
      })
    }
  }

  /**
   * Get unread message count
   * GET /api/support/tickets/unread-count
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id
      const isPlatformAdmin = req.user?.isPlatformAdmin
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return
      }

      let count: number
      if (isPlatformAdmin) {
        count = await supportTicketService.countUnreadMessagesForAdmin()
      } else {
        count = await supportTicketService.countUnreadMessages(userId)
      }

      res.json({
        success: true,
        data: { unreadCount: count },
      })
    } catch (error) {
      logger.error("Error getting unread count:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get unread count",
      })
    }
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Get all tickets (admin only)
   * GET /api/admin/support/tickets
   * Query: page, limit, status, issueType
   */
  async getAllTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const isPlatformAdmin = await checkIsPlatformAdmin(req)
      logger.info(`🎫 getAllTickets - isPlatformAdmin: ${isPlatformAdmin}`)
      
      if (!isPlatformAdmin) {
        res.status(403).json({
          success: false,
          error: "Only platform admins can view all tickets",
        })
        return
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const status = req.query.status as SupportTicketStatus | undefined
      const issueType = req.query.issueType as SupportIssueType | undefined

      const result = await supportTicketService.getAllTickets(
        page,
        limit,
        status,
        issueType
      )

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error("Error getting all tickets:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get tickets",
      })
    }
  }
}

export const supportTicketController = new SupportTicketController()
