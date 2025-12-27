"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageController = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const usage_service_1 = require("../services/usage.service");
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
exports.usageController = {
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
    getStats(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { startDate, endDate, clientId } = req.query;
                logger_1.default.info(`[USAGE-CONTROLLER] 📊 Getting usage stats for workspace ${workspaceId}`);
                // Parse dates if provided
                const parsedStartDate = startDate ? new Date(startDate) : undefined;
                const parsedEndDate = endDate ? new Date(endDate) : undefined;
                const stats = yield usage_service_1.usageService.getUsageStats({
                    workspaceId,
                    startDate: parsedStartDate,
                    endDate: parsedEndDate,
                    clientId: clientId,
                });
                logger_1.default.info(`[USAGE-CONTROLLER] ✅ Stats retrieved: €${stats.totalCost.toFixed(4)}, ${stats.totalMessages} messages`);
                res.json({
                    success: true,
                    data: stats,
                    meta: {
                        workspaceId,
                        period: {
                            start: parsedStartDate === null || parsedStartDate === void 0 ? void 0 : parsedStartDate.toISOString(),
                            end: parsedEndDate === null || parsedEndDate === void 0 ? void 0 : parsedEndDate.toISOString(),
                        },
                        generatedAt: new Date().toISOString(),
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`[USAGE-CONTROLLER] ❌ Error getting usage stats:`, error);
                next(error);
            }
        });
    },
    /**
     * GET /api/usage/summary/:workspaceId
     * Get usage summary for a specific period
     */
    getSummary(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { days = "30" } = req.query;
                logger_1.default.info(`[USAGE-CONTROLLER] 📋 Getting usage summary for workspace ${workspaceId}, last ${days} days`);
                const summary = yield usage_service_1.usageService.getUsageSummary(workspaceId, parseInt(days, 10));
                logger_1.default.info(`[USAGE-CONTROLLER] ✅ Summary retrieved: €${summary.totalCost.toFixed(4)} total`);
                res.json({
                    success: true,
                    data: summary,
                    meta: {
                        workspaceId,
                        days: parseInt(days, 10),
                        generatedAt: new Date().toISOString(),
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`[USAGE-CONTROLLER] ❌ Error getting usage summary:`, error);
                next(error);
            }
        });
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
    getDashboardData(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { workspaceId } = req.params;
                const { period = "30" } = req.query;
                logger_1.default.info(`[USAGE-CONTROLLER] 🎯 Getting dashboard data for workspace ${workspaceId}`);
                const days = parseInt(period, 10);
                const endDate = new Date();
                const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                // Get both stats and summary in parallel
                const [stats, summary] = yield Promise.all([
                    usage_service_1.usageService.getUsageStats({
                        workspaceId,
                        startDate,
                        endDate,
                    }),
                    usage_service_1.usageService.getUsageSummary(workspaceId, days),
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
                        peakHour: ((_a = stats.peakHours[0]) === null || _a === void 0 ? void 0 : _a.hour) || null,
                        busiestDay: stats.dailyUsage.reduce((max, day) => (day.messages > max.messages ? day : max), { date: "", messages: 0, cost: 0 }),
                    },
                };
                logger_1.default.info(`[USAGE-CONTROLLER] ✅ Dashboard data compiled for workspace ${workspaceId}`);
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
            }
            catch (error) {
                logger_1.default.error(`[USAGE-CONTROLLER] ❌ Error getting dashboard data:`, error);
                next(error);
            }
        });
    },
    /**
     * GET /api/usage/export/:workspaceId
     * Export usage data to CSV
     */
    exportData(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { startDate, endDate, format = "csv" } = req.query;
                logger_1.default.info(`[USAGE-CONTROLLER] 📤 Exporting usage data for workspace ${workspaceId}`);
                const parsedStartDate = startDate
                    ? new Date(startDate)
                    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default: last 90 days
                const parsedEndDate = endDate ? new Date(endDate) : new Date();
                const stats = yield usage_service_1.usageService.getUsageStats({
                    workspaceId,
                    startDate: parsedStartDate,
                    endDate: parsedEndDate,
                });
                if (format === "csv") {
                    // Generate CSV content
                    const csvHeader = "Date,Client Name,Client Phone,Cost (EUR),Messages\n";
                    const csvRows = stats.dailyUsage.flatMap(day => stats.topClients.map(client => `${day.date},${client.clientName},${client.clientPhone},${client.cost.toFixed(4)},${client.messages}`)).join("\n");
                    const csvContent = csvHeader + csvRows;
                    res.setHeader("Content-Type", "text/csv");
                    res.setHeader("Content-Disposition", `attachment; filename="usage-${workspaceId}-${parsedStartDate.toISOString().split('T')[0]}-${parsedEndDate.toISOString().split('T')[0]}.csv"`);
                    res.send(csvContent);
                }
                else {
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
                logger_1.default.info(`[USAGE-CONTROLLER] ✅ Data exported for workspace ${workspaceId}`);
            }
            catch (error) {
                logger_1.default.error(`[USAGE-CONTROLLER] ❌ Error exporting usage data:`, error);
                next(error);
            }
        });
    },
};
//# sourceMappingURL=usage.controller.js.map