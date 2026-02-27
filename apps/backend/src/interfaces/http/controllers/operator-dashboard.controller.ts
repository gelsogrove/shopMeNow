/**
 * OperatorDashboardController
 *
 * Token-based (no login) operator selection dashboard endpoints.
 * The dashboard shows all customers waiting in queue with AI summaries,
 * so the operator can choose who to handle first based on urgency.
 *
 * Endpoints:
 *  GET  /api/v1/operator-dashboard/queue?token=xxx   → list of waiting customers + AI summaries
 *  POST /api/v1/operator-dashboard/assign            → pick a customer, get support_chat token
 *
 * Auth: operator_dashboard token (workspace-level, 48h, no customerId)
 */

// ============================================================================
// IMPORTS
// ============================================================================
import { Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import { OperatorQueueService } from "../../../application/services/operator-queue.service"
import logger from "../../../utils/logger"

// ============================================================================
// CONTROLLER
// ============================================================================

const secureTokenService = new SecureTokenService()

export class OperatorDashboardController {
  // ----------------------------------------------------------------
  // GET /queue?token=xxx
  // ----------------------------------------------------------------
  async getQueue(req: Request, res: Response): Promise<void> {
    const { token } = req.query as { token?: string }

    if (!token) {
      res.status(400).json({ error: "token required" })
      return
    }

    try {
      // Validate token — must be operator_dashboard type
      const validation = await secureTokenService.validateToken(token)
      if (!validation.valid || !validation.data) {
        res.status(401).json({ error: "Invalid or expired token" })
        return
      }

      if (validation.data.type !== "operator_dashboard") {
        res.status(401).json({ error: "Invalid token type" })
        return
      }

      const { workspaceId } = validation.data as { workspaceId: string; type: string }

      if (!workspaceId) {
        res.status(401).json({ error: "Malformed token" })
        return
      }

      const operatorQueueService = new OperatorQueueService(prisma)

      // Get waiting customers (without summaries first)
      const customers = await operatorQueueService.getWaitingCustomers(workspaceId)

      if (customers.length === 0) {
        res.json([])
        return
      }

      // Generate AI summaries in parallel (on-demand)
      const enriched = await Promise.all(
        customers.map(async (entry) => {
          const aiSummary = await operatorQueueService.generateAISummary(
            workspaceId,
            entry.customerId
          )
          return { ...entry, aiSummary }
        })
      )

      res.json(enriched)
    } catch (error) {
      logger.error("[OperatorDashboard] getQueue error:", error)
      res.status(500).json({ error: "Server error" })
    }
  }

  // ----------------------------------------------------------------
  // POST /assign   body: { token, customerId }
  // ----------------------------------------------------------------
  async assignCustomer(req: Request, res: Response): Promise<void> {
    const { token, customerId } = req.body as {
      token?: string
      customerId?: string
    }

    if (!token || !customerId) {
      res.status(400).json({ error: "token and customerId are required" })
      return
    }

    try {
      // Validate token — must be operator_dashboard type
      const validation = await secureTokenService.validateToken(token)
      if (!validation.valid || !validation.data) {
        res.status(401).json({ error: "Invalid or expired token" })
        return
      }

      if (validation.data.type !== "operator_dashboard") {
        res.status(401).json({ error: "Invalid token type" })
        return
      }

      const { workspaceId } = validation.data as { workspaceId: string; type: string }

      if (!workspaceId) {
        res.status(401).json({ error: "Malformed token" })
        return
      }

      const operatorQueueService = new OperatorQueueService(prisma)

      try {
        const result = await operatorQueueService.assignCustomer(workspaceId, customerId)
        res.json({ token: result.token, chatUrl: result.chatUrl })
      } catch (assignError) {
        if (
          assignError instanceof Error &&
          assignError.message === "CUSTOMER_NOT_IN_QUEUE"
        ) {
          res.status(400).json({ error: "Customer not found in queue" })
          return
        }
        throw assignError
      }
    } catch (error) {
      logger.error("[OperatorDashboard] assignCustomer error:", error)
      res.status(500).json({ error: "Server error" })
    }
  }
}

export const operatorDashboardController = new OperatorDashboardController()
