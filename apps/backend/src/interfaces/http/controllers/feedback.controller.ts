import { PrismaClient } from "@echatbot/database"
import { NextFunction, Request, Response } from "express"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import logger from "../../../utils/logger"

const prisma = new PrismaClient()

/**
 * Controller for customer feedback (public access with token)
 */
export class FeedbackController {
  private secureTokenService: SecureTokenService

  constructor() {
    this.secureTokenService = new SecureTokenService()
  }

  /**
   * Get customer feedback by ID
   * Used for displaying existing feedback
   */
  async getFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.query

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Token richiesto" })
      }

      // Validate token
      const validation = await this.secureTokenService.validateToken(token)

      if (!validation.valid || !validation.data) {
        return res.status(401).json({ error: "Token invalido o scaduto" })
      }

      const { customerId, workspaceId } = validation.data

      // Get customer feedback
      const feedback = await prisma.customerFeedback.findFirst({
        where: {
          customerId,
          workspaceId,
        },
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })

      res.json({
        feedback: feedback || null,
        customer: validation.data,
      })
    } catch (error) {
      logger.error("Error getting feedback:", error)
      next(error)
    }
  }

  /**
   * Submit customer feedback (public endpoint with token validation)
   */
  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, rating, comment } = req.body

      // Validation
      if (!token) {
        return res.status(400).json({ error: "Token richiesto" })
      }

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          error: "Valutazione obbligatoria",
          message: "La valutazione deve essere tra 1 e 5 stelle",
        })
      }

      // Validate token
      const validation = await this.secureTokenService.validateToken(token)

      if (!validation.valid || !validation.data) {
        return res.status(401).json({
          error: "Token invalido o scaduto",
          message: "Il link è scaduto o non è valido. Richiedi un nuovo link.",
        })
      }

      const { customerId, workspaceId } = validation.data
      const campaignId = validation.payload?.campaignId

      // Check if customer already submitted feedback recently (avoid duplicates)
      const existingFeedback = await prisma.customerFeedback.findFirst({
        where: {
          customerId,
          workspaceId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      })

      if (existingFeedback) {
        // Update existing feedback instead of creating duplicate
        const updated = await prisma.customerFeedback.update({
          where: { id: existingFeedback.id },
          data: {
            rating,
            comment: comment || null,
          },
        })

        logger.info(
          `Updated feedback ${updated.id} for customer ${customerId} (rating: ${rating})`
        )

        return res.json({
          message: "Grazie! La tua recensione è stata aggiornata.",
          feedback: updated,
        })
      }

      // Create new feedback
      const feedback = await prisma.customerFeedback.create({
        data: {
          customerId,
          workspaceId,
          campaignId: campaignId || null,
          rating,
          comment: comment || null,
        },
      })

      logger.info(
        `Created feedback ${feedback.id} for customer ${customerId} (rating: ${rating})`
      )

      // Mark token as used
      await this.secureTokenService.markTokenAsUsed(token)

      res.status(201).json({
        message: "Grazie per il tuo feedback! 🙏",
        feedback,
      })
    } catch (error) {
      logger.error("Error submitting feedback:", error)
      next(error)
    }
  }

  /**
   * Get all feedbacks for a workspace (admin endpoint)
   */
  async getWorkspaceFeedbacks(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params
      const { page = 1, limit = 20 } = req.query

      const skip = (Number(page) - 1) * Number(limit)

      const [feedbacks, total] = await Promise.all([
        prisma.customerFeedback.findMany({
          where: { workspaceId },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.customerFeedback.count({ where: { workspaceId } }),
      ])

      // Calculate average rating
      const avgRating = await prisma.customerFeedback.aggregate({
        where: { workspaceId },
        _avg: { rating: true },
      })

      res.json({
        data: feedbacks,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
        stats: {
          averageRating: avgRating._avg.rating || 0,
          totalFeedbacks: total,
        },
      })
    } catch (error) {
      logger.error("Error getting workspace feedbacks:", error)
      next(error)
    }
  }
}
