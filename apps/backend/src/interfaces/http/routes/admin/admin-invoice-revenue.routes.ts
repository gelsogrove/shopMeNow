/**
 * 📊 ADMIN INVOICE REVENUE STATS ROUTES
 *
 * Revenue and usage statistics for the analytics dashboard.
 * Split from admin-invoice-paypal.routes.ts for file size compliance (<500 lines).
 */

import { Router, Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"
import { roundMoney } from "../../../../utils/money"

const router = Router()

// ── Revenue stats (analytics) ───────────────────────────────────────────────

/**
 * @swagger
 * /api/users/admin/analytics/revenue-stats:
 *   get:
 *     summary: Get complete revenue and usage statistics for analytics dashboard
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Monthly statistics including revenue, users, messages, and push campaigns
 */
router.get(
  "/admin/analytics/revenue-stats",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const monthsParam = Number(req.query.months ?? 12)
      const monthsToLoad = Number.isFinite(monthsParam) && monthsParam > 0 ? monthsParam : 12

      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth() - (monthsToLoad - 1), 1)

      // Fetch invoices for revenue data
      const invoices = await prisma.monthlyInvoice.findMany({
        where: {
          status: "PAID",
          periodStart: { gte: startDate },
        },
        select: {
          periodYear: true,
          periodMonth: true,
          totalAmount: true,
          userId: true,
        },
      })

      // Fetch messages with channel info from ChatSession
      const messages = await prisma.message.findMany({
        where: {
          createdAt: { gte: startDate },
          chatSession: {
            channel: { in: ["whatsapp", "widget"] },
          },
        },
        select: {
          createdAt: true,
          chatSession: {
            select: {
              channel: true,
            },
          },
        },
      })

      // Fetch push campaigns
      const campaigns = await prisma.pushCampaign.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        select: {
          createdAt: true,
          _count: {
            select: {
              recipients: true,
            },
          },
        },
      })

      // Build monthly statistics
      const statsMap = new Map<
        string,
        {
          periodYear: number
          periodMonth: number
          revenue: number
          userCount: Set<string>
          whatsappMessages: number
          widgetMessages: number
          pushCampaigns: number
          pushRecipients: number
        }
      >()

      // Process invoices for revenue
      invoices.forEach((invoice) => {
        const key = `${invoice.periodYear}-${invoice.periodMonth}`
        const entry = statsMap.get(key) || {
          periodYear: invoice.periodYear,
          periodMonth: invoice.periodMonth,
          revenue: 0,
          userCount: new Set<string>(),
          whatsappMessages: 0,
          widgetMessages: 0,
          pushCampaigns: 0,
          pushRecipients: 0,
        }
        entry.revenue += Number(invoice.totalAmount || 0)
        entry.userCount.add(invoice.userId)
        statsMap.set(key, entry)
      })

      // Process messages
      messages.forEach((message) => {
        const date = new Date(message.createdAt)
        const periodYear = date.getFullYear()
        const periodMonth = date.getMonth() + 1
        const key = `${periodYear}-${periodMonth}`
        
        const entry = statsMap.get(key) || {
          periodYear,
          periodMonth,
          revenue: 0,
          userCount: new Set<string>(),
          whatsappMessages: 0,
          widgetMessages: 0,
          pushCampaigns: 0,
          pushRecipients: 0,
        }

        if (message.chatSession.channel === "whatsapp") {
          entry.whatsappMessages += 1
        } else if (message.chatSession.channel === "widget") {
          entry.widgetMessages += 1
        }

        statsMap.set(key, entry)
      })

      // Process push campaigns
      campaigns.forEach((campaign) => {
        const date = new Date(campaign.createdAt)
        const periodYear = date.getFullYear()
        const periodMonth = date.getMonth() + 1
        const key = `${periodYear}-${periodMonth}`
        
        const entry = statsMap.get(key) || {
          periodYear,
          periodMonth,
          revenue: 0,
          userCount: new Set<string>(),
          whatsappMessages: 0,
          widgetMessages: 0,
          pushCampaigns: 0,
          pushRecipients: 0,
        }

        entry.pushCampaigns += 1
        entry.pushRecipients += campaign._count.recipients

        statsMap.set(key, entry)
      })

      // Build time series for all months
      const monthSeries: Array<{
        periodYear: number
        periodMonth: number
        revenue: number
        userCount: number
        whatsappMessages: number
        widgetMessages: number
        totalMessages: number
        pushCampaigns: number
        pushRecipients: number
      }> = []

      for (let index = monthsToLoad - 1; index >= 0; index -= 1) {
        const cursor = new Date(now.getFullYear(), now.getMonth() - index, 1)
        const periodYear = cursor.getFullYear()
        const periodMonth = cursor.getMonth() + 1
        const key = `${periodYear}-${periodMonth}`
        const entry = statsMap.get(key)

        monthSeries.push({
          periodYear,
          periodMonth,
          revenue: roundMoney(entry?.revenue ?? 0),
          userCount: entry?.userCount.size ?? 0,
          whatsappMessages: entry?.whatsappMessages ?? 0,
          widgetMessages: entry?.widgetMessages ?? 0,
          totalMessages: (entry?.whatsappMessages ?? 0) + (entry?.widgetMessages ?? 0),
          pushCampaigns: entry?.pushCampaigns ?? 0,
          pushRecipients: entry?.pushRecipients ?? 0,
        })
      }

      // Calculate totals
      const totals = monthSeries.reduce(
        (acc, month) => ({
          revenue: acc.revenue + month.revenue,
          whatsappMessages: acc.whatsappMessages + month.whatsappMessages,
          widgetMessages: acc.widgetMessages + month.widgetMessages,
          totalMessages: acc.totalMessages + month.totalMessages,
          pushCampaigns: acc.pushCampaigns + month.pushCampaigns,
          pushRecipients: acc.pushRecipients + month.pushRecipients,
        }),
        {
          revenue: 0,
          whatsappMessages: 0,
          widgetMessages: 0,
          totalMessages: 0,
          pushCampaigns: 0,
          pushRecipients: 0,
        }
      )

      res.json({
        success: true,
        data: {
          monthSeries,
          totals,
        },
        meta: {
          months: monthsToLoad,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching revenue stats:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch revenue statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
)

export default router
