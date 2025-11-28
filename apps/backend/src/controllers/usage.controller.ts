import logger from "../utils/logger"
import { NextFunction, Request, Response } from "express";
import { usageService } from "../services/usage.service";

/**
 * @swagger
 * components:
 *   schemas:
 *     UsageStats:
 *       type: object
 *       properties:
 *         totalCost:
 *           type: number
 *           description: Total cost in EUR
 *         totalMessages:
 *           type: number
 *           description: Total number of messages
 *         dailyUsage:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               cost:
 *                 type: number
 *               messages:
 *                 type: number
 *         topClients:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *               clientName:
 *                 type: string
 *               clientPhone:
 *                 type: string
 *               cost:
 *                 type: number
 *               messages:
 *                 type: number
 *         peakHours:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               hour:
 *                 type: number
 *               messages:
 *                 type: number
 *               cost:
 *                 type: number
 *         monthlyComparison:
 *           type: object
 *           properties:
 *             currentMonth:
 *               type: number
 *             previousMonth:
 *               type: number
 *             growth:
 *               type: number
 */

export const usageController = {
  /**
   * @swagger
   * /api/usage/stats/{workspaceId}:
   *   get:
   *     summary: Get usage statistics for dashboard
   *     tags: [Usage]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Workspace ID
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for statistics
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for statistics
   *       - in: query
   *         name: clientId
   *         schema:
   *           type: string
   *         description: Filter by specific client ID
   *     responses:
   *       200:
   *         description: Usage statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/UsageStats'
   *                 meta:
   *                   type: object
   *       400:
   *         description: Bad request
   *       500:
   *         description: Internal server error
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params;
      const { startDate, endDate, clientId } = req.query;

      logger.info(`[USAGE-CONTROLLER] 📊 Getting usage stats for workspace ${workspaceId}`);

      // Parse dates if provided
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      const stats = await usageService.getUsageStats({
        workspaceId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        clientId: clientId as string | undefined,
      });

      logger.info(`[USAGE-CONTROLLER] ✅ Stats retrieved: €${stats.totalCost.toFixed(4)}, ${stats.totalMessages} messages`);

      res.json({
        success: true,
        data: stats,
        meta: {
          workspaceId,
          period: {
            start: parsedStartDate?.toISOString(),
            end: parsedEndDate?.toISOString(),
          },
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(`[USAGE-CONTROLLER] ❌ Error getting usage stats:`, error);
      next(error);
    }
  },

  /**
   * GET /api/usage/summary/:workspaceId
   * Get usage summary for a specific period
   */
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params;
      const { days = "30" } = req.query;

      logger.info(`[USAGE-CONTROLLER] 📋 Getting usage summary for workspace ${workspaceId}, last ${days} days`);

      const summary = await usageService.getUsageSummary(
        workspaceId,
        parseInt(days as string, 10)
      );

      logger.info(`[USAGE-CONTROLLER] ✅ Summary retrieved: €${summary.totalCost.toFixed(4)} total`);

      res.json({
        success: true,
        data: summary,
        meta: {
          workspaceId,
          days: parseInt(days as string, 10),
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(`[USAGE-CONTROLLER] ❌ Error getting usage summary:`, error);
      next(error);
    }
  },

  /**
   * @swagger
   * /api/usage/dashboard/{workspaceId}:
   *   get:
   *     summary: Get comprehensive dashboard data
   *     tags: [Usage]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Workspace ID
   *       - in: query
   *         name: period
   *         schema:
   *           type: number
   *           default: 30
   *         description: Number of days to include in statistics
   *     responses:
   *       200:
   *         description: Dashboard data retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     overview:
   *                       type: object
   *                     charts:
   *                       type: object
   *                     insights:
   *                       type: object
   *       500:
   *         description: Internal server error
   */
  async getDashboardData(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params;
      const { period = "30" } = req.query;

      logger.info(`[USAGE-CONTROLLER] 🎯 Getting dashboard data for workspace ${workspaceId}`);

      const days = parseInt(period as string, 10);
      const endDate = new Date();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get both stats and summary in parallel
      const [stats, summary] = await Promise.all([
        usageService.getUsageStats({
          workspaceId,
          startDate,
          endDate,
        }),
        usageService.getUsageSummary(workspaceId, days),
      ]);

      const dashboardData = {
        overview: {
          totalCost: stats.totalCost,
          totalMessages: stats.totalMessages,
          averageDailyCost: summary.averageDailyCost,
          averageDailyMessages: summary.averageDailyMessages,
          monthlyComparison: stats.monthlyComparison,
        },
        charts: {
          dailyUsage: stats.dailyUsage,
          peakHours: stats.peakHours,
        },
        insights: {
          topClients: stats.topClients,
          peakHour: stats.peakHours[0]?.hour || null,
          busiestDay: stats.dailyUsage.reduce(
            (max, day) => (day.messages > max.messages ? day : max),
            { date: "", messages: 0, cost: 0 }
          ),
        },
      };

      logger.info(`[USAGE-CONTROLLER] ✅ Dashboard data compiled for workspace ${workspaceId}`);

      res.json({
        success: true,
        data: dashboardData,
        meta: {
          workspaceId,
          period: {
            days,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(`[USAGE-CONTROLLER] ❌ Error getting dashboard data:`, error);
      next(error);
    }
  },

  /**
   * GET /api/usage/export/:workspaceId
   * Export usage data to CSV
   */
  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.params;
      const { startDate, endDate, format = "csv" } = req.query;

      logger.info(`[USAGE-CONTROLLER] 📤 Exporting usage data for workspace ${workspaceId}`);

      const parsedStartDate = startDate 
        ? new Date(startDate as string) 
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default: last 90 days
      const parsedEndDate = endDate ? new Date(endDate as string) : new Date();

      const stats = await usageService.getUsageStats({
        workspaceId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      });

      if (format === "csv") {
        // Generate CSV content
        const csvHeader = "Date,Client Name,Client Phone,Cost (EUR),Messages\n";
        const csvRows = stats.dailyUsage.flatMap(day => 
          stats.topClients.map(client => 
            `${day.date},${client.clientName},${client.clientPhone},${client.cost.toFixed(4)},${client.messages}`
          )
        ).join("\n");

        const csvContent = csvHeader + csvRows;

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="usage-${workspaceId}-${parsedStartDate.toISOString().split('T')[0]}-${parsedEndDate.toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        // Return JSON format
        res.json({
          success: true,
          data: stats,
          meta: {
            workspaceId,
            format,
            period: {
              start: parsedStartDate.toISOString(),
              end: parsedEndDate.toISOString(),
            },
            exportedAt: new Date().toISOString(),
          },
        });
      }

      logger.info(`[USAGE-CONTROLLER] ✅ Data exported for workspace ${workspaceId}`);
    } catch (error) {
      logger.error(`[USAGE-CONTROLLER] ❌ Error exporting usage data:`, error);
      next(error);
    }
  },
};