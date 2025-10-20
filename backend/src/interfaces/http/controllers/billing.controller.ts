import { PrismaClient } from "@prisma/client"
import { Request, Response } from "express"
import { BillingService } from "../../../application/services/billing.service"
import logger from "../../../utils/logger"

export class BillingController {
  private billingService: BillingService
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
    this.billingService = new BillingService(this.prisma)
  }

  /**
   * Get current billing totals for a workspace
   * GET /api/billing/:workspaceId/totals
   */
  async getTotals(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params
      const { customerId } = req.query

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: "Workspace ID is required",
        })
        return
      }

      let currentTotal: number

      if (customerId && typeof customerId === "string") {
        // Get total for specific customer
        currentTotal = await this.billingService.getCurrentTotalForCustomer(
          workspaceId,
          customerId
        )
      } else {
        // Get total for entire workspace
        currentTotal = await this.billingService.getCurrentTotal(workspaceId)
      }

      res.json({
        success: true,
        data: {
          workspaceId,
          customerId: customerId || null,
          currentTotal: currentTotal.toFixed(2),
          currency: "EUR",
        },
      })
    } catch (error) {
      logger.error("Error getting billing totals:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get billing totals",
      })
    }
  }

  /**
   * Get detailed billing summary for a workspace
   * GET /api/billing/:workspaceId/summary
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: "Workspace ID is required",
        })
        return
      }

      const summary = await this.billingService.getBillingSummary(workspaceId)

      res.json({
        success: true,
        data: {
          workspaceId,
          ...summary,
          currency: "EUR",
        },
      })
    } catch (error) {
      logger.error("Error getting billing summary:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get billing summary",
      })
    }
  }

  /**
   * Get billing history with simple format: current + new = total
   * GET /api/billing/:workspaceId/history
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params
      const { customerId, limit = 50 } = req.query

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: "Workspace ID is required",
        })
        return
      }

      const whereClause: any = { workspaceId }
      if (customerId) {
        whereClause.customerId = customerId
      }

      // Get all billing records
      const records = await this.prisma.billing.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        include: {
          customer: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
      })

      // Calculate running total
      let runningTotal = 0
      const history = records.reverse().map((record) => {
        const previousTotal = runningTotal
        const newCharge = record.amount
        runningTotal += newCharge

        return {
          id: record.id,
          date: record.createdAt,
          type: record.type,
          description: record.description,
          customer: record.customer
            ? {
                name: record.customer.name,
                phone: record.customer.phone,
              }
            : null,
          // Simple format: previous + new = total
          previousTotal: previousTotal.toFixed(2),
          newCharge: newCharge.toFixed(2),
          newTotal: runningTotal.toFixed(2),
        }
      })

      res.json({
        success: true,
        data: {
          workspaceId,
          customerId: customerId || null,
          history: history.reverse(), // Reverse back to show latest first
          currentTotal: runningTotal.toFixed(2),
          currency: "EUR",
        },
      })
    } catch (error) {
      logger.error("Error getting billing history:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get billing history",
      })
    }
  }

  /**
   * Get monthly billing breakdown for current month + 12 months history
   * GET /api/billing/:workspaceId/monthly
   */
  async getMonthlyBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: "Workspace ID is required",
        })
        return
      }

      logger.info(
        `[BILLING-CONTROLLER] 📊 Getting monthly breakdown for workspace ${workspaceId}`
      )

      const breakdown =
        await this.billingService.getMonthlyBreakdown(workspaceId)

      res.json({
        success: true,
        data: {
          workspaceId,
          currentMonth: breakdown.currentMonth,
          history: breakdown.history,
          currency: "EUR",
        },
      })
    } catch (error) {
      logger.error("Error getting monthly billing breakdown:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get monthly billing breakdown",
      })
    }
  }

  /**
   * Get detailed billing records for a specific month
   * GET /api/billing/:workspaceId/monthly/:year/:month
   */
  async getMonthDetail(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, year, month } = req.params

      if (!workspaceId || !year || !month) {
        res.status(400).json({
          success: false,
          error: "Workspace ID, year, and month are required",
        })
        return
      }

      const yearNum = parseInt(year)
      const monthNum = parseInt(month)

      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        res.status(400).json({
          success: false,
          error: "Invalid year or month",
        })
        return
      }

      logger.info(
        `[BILLING-CONTROLLER] 📋 Getting month detail for ${yearNum}-${monthNum} (workspace ${workspaceId})`
      )

      const details = await this.billingService.getMonthDetail(
        workspaceId,
        yearNum,
        monthNum
      )

      res.json({
        success: true,
        data: {
          workspaceId,
          year: yearNum,
          month: monthNum,
          records: details,
          currency: "EUR",
        },
      })
    } catch (error) {
      logger.error("Error getting month detail:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get month detail",
      })
    }
  }
}
