import { NextFunction, Request, Response } from "express"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import logger from "../../../utils/logger"

/**
 * Controller for customer feedback (public access with token)
 * NOTE: CustomerFeedback model has been removed from schema.
 * These endpoints return empty/stub responses to avoid breaking clients.
 */
export class FeedbackController {
  private secureTokenService: SecureTokenService

  constructor() {
    this.secureTokenService = new SecureTokenService()
  }

  /**
   * Get customer feedback by ID — returns null (model removed)
   */
  async getFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.query

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Token required" })
      }

      const validation = await this.secureTokenService.validateToken(token)
      if (!validation.valid || !validation.data) {
        return res.status(401).json({ error: "Invalid or expired token" })
      }

      res.json({
        feedback: null,
        customer: validation.data,
      })
    } catch (error) {
      logger.error("Error getting feedback:", error)
      next(error)
    }
  }

  /**
   * Submit customer feedback — disabled (model removed)
   */
  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(410).json({
        error: "Feedback feature is currently unavailable",
        message: "This feature has been temporarily disabled.",
      })
    } catch (error) {
      logger.error("Error submitting feedback:", error)
      next(error)
    }
  }

  /**
   * Get all feedbacks for a workspace — returns empty (model removed)
   */
  async getWorkspaceFeedbacks(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
        stats: {
          averageRating: 0,
          totalFeedbacks: 0,
        },
      })
    } catch (error) {
      logger.error("Error getting workspace feedbacks:", error)
      next(error)
    }
  }
}
