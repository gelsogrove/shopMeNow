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
exports.AnalyticsController = void 0;
const analytics_service_1 = require("../../../application/services/analytics.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class AnalyticsController {
    constructor() {
        /**
         * @swagger
         * /api/analytics/{workspaceId}/dashboard:
         *   get:
         *     summary: Get dashboard analytics data
         *     description: Retrieve analytics data for dashboard with optional date range filtering. Default shows last 3 complete months excluding current month.
         *     tags: [Analytics]
         *     security:
         *       - bearerAuth: []
         *     parameters:
         *       - in: path
         *         name: workspaceId
         *         required: true
         *         description: The workspace ID
         *         schema:
         *           type: string
         *       - in: query
         *         name: startDate
         *         required: false
         *         description: Start date for filtering (ISO 8601 format)
         *         schema:
         *           type: string
         *           format: date-time
         *       - in: query
         *         name: endDate
         *         required: false
         *         description: End date for filtering (ISO 8601 format)
         *         schema:
         *           type: string
         *           format: date-time
         *     responses:
         *       200:
         *         description: Dashboard analytics data
         *         content:
         *           application/json:
         *             schema:
         *               type: object
         *               properties:
         *                 success:
         *                   type: boolean
         *                 data:
         *                   $ref: '#/components/schemas/DashboardAnalytics'
         *                 dateRange:
         *                   type: object
         *                   properties:
         *                     startDate:
         *                       type: string
         *                       format: date-time
         *                     endDate:
         *                       type: string
         *                       format: date-time
         *                     isDefault:
         *                       type: boolean
         *                     note:
         *                       type: string
         *       401:
         *         description: Unauthorized
         *       500:
         *         description: Server error
         */
        this.getDashboardData = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { startDate, endDate } = req.query;
                // Default to last 3 complete months (excluding current month)
                const defaultDateRange = this.getDefaultDateRange();
                const dateFrom = startDate
                    ? new Date(startDate)
                    : defaultDateRange.startDate;
                const dateTo = endDate
                    ? new Date(endDate)
                    : defaultDateRange.endDate;
                const analyticsData = yield this.analyticsService.getDashboardAnalytics(workspaceId, dateFrom, dateTo);
                res.json({
                    success: true,
                    data: analyticsData,
                    dateRange: {
                        startDate: dateFrom,
                        endDate: dateTo,
                        isDefault: !startDate && !endDate,
                        note: !startDate && !endDate
                            ? "Default range: last 3 complete months (excluding current month)"
                            : null,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error getting dashboard data:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to get dashboard analytics data",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
        /**
         * @swagger
         * /api/analytics/{workspaceId}/detailed:
         *   get:
         *     summary: Get detailed metrics for a specific metric type
         *     description: Retrieve detailed analytics data for a specific metric (orders, customers, products)
         *     tags: [Analytics]
         *     security:
         *       - bearerAuth: []
         *     parameters:
         *       - in: path
         *         name: workspaceId
         *         required: true
         *         description: The workspace ID
         *         schema:
         *           type: string
         *       - in: query
         *         name: startDate
         *         required: true
         *         description: Start date for filtering (ISO 8601 format)
         *         schema:
         *           type: string
         *           format: date-time
         *       - in: query
         *         name: endDate
         *         required: true
         *         description: End date for filtering (ISO 8601 format)
         *         schema:
         *           type: string
         *           format: date-time
         *       - in: query
         *         name: metric
         *         required: true
         *         description: The metric type to retrieve detailed data for
         *         schema:
         *           type: string
         *           enum: [orders, customers, products]
         *     responses:
         *       200:
         *         description: Detailed metrics data
         *         content:
         *           application/json:
         *             schema:
         *               type: object
         *               properties:
         *                 success:
         *                   type: boolean
         *                 data:
         *                   type: array
         *                   items:
         *                     type: object
         *       400:
         *         description: Bad request - missing required parameters
         *       401:
         *         description: Unauthorized
         *       500:
         *         description: Server error
         */
        this.getDetailedMetrics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { startDate, endDate, metric } = req.query;
                if (!startDate || !endDate) {
                    res.status(400).json({
                        success: false,
                        message: "Start date and end date are required for detailed metrics",
                    });
                    return;
                }
                const detailedData = yield this.analyticsService.getDetailedMetrics(workspaceId, new Date(startDate), new Date(endDate), metric);
                res.json({
                    success: true,
                    data: detailedData,
                });
            }
            catch (error) {
                logger_1.default.error("Error getting detailed metrics:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to get detailed metrics",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
        /**
         * @swagger
         * /api/analytics/{workspaceId}/monthly-top-customers:
         *   get:
         *     summary: Get monthly top customers breakdown
         *     description: Retrieve top customers for each month in the specified date range
         *     tags: [Analytics]
         *     security:
         *       - bearerAuth: []
         *     parameters:
         *       - in: path
         *         name: workspaceId
         *         required: true
         *         description: The workspace ID
         *         schema:
         *           type: string
         *       - in: query
         *         name: startDate
         *         required: true
         *         description: Start date for filtering (ISO 8601 format)
         *         schema:
         *           type: string
         *           format: date-time
         *       - in: query
         *         name: endDate
         *         required: true
         *         description: End date for filtering (ISO 8601 format)
         *         schema:
         *           type: string
         *           format: date-time
         *     responses:
         *       200:
         *         description: Monthly top customers data
         *       400:
         *         description: Bad request
         *       401:
         *         description: Unauthorized
         *       500:
         *         description: Server error
         */
        this.getMonthlyTopCustomers = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { startDate, endDate } = req.query;
                if (!startDate || !endDate) {
                    res.status(400).json({
                        success: false,
                        message: "Start date and end date are required",
                    });
                    return;
                }
                const monthlyData = yield this.analyticsService.getMonthlyTopCustomers(workspaceId, new Date(startDate), new Date(endDate));
                res.json(monthlyData);
            }
            catch (error) {
                logger_1.default.error("Error getting monthly top customers:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to get monthly top customers",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
        /**
         * @swagger
         * /api/analytics/{workspaceId}/monthly-top-clients:
         *   get:
         *     summary: Get monthly top clients breakdown
         *     description: Retrieve top clients for each month in the specified date range
         *     tags: [Analytics]
         *     security:
         *       - bearerAuth: []
         *     parameters:
         *       - in: path
         *         name: workspaceId
         *         required: true
         *         description: The workspace ID
         *         schema:
         *           type: string
         *       - in: query
         *         name: startDate
         *         required: true
         *         description: Start date for filtering (ISO 8601 format)
         *         schema:
         *           type: string
         *           format: date-time
         *       - in: query
         *         name: endDate
         *         required: true
         *         description: End date for filtering (ISO 8601 format)
         *         schema:
         *           type: string
         *           format: date-time
         *     responses:
         *       200:
         *         description: Monthly top clients data
         *       400:
         *         description: Bad request
         *       401:
         *         description: Unauthorized
         *       500:
         *         description: Server error
         */
        this.getMonthlyTopClients = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { startDate, endDate } = req.query;
                if (!startDate || !endDate) {
                    res.status(400).json({
                        success: false,
                        message: "Start date and end date are required",
                    });
                    return;
                }
                const monthlyData = yield this.analyticsService.getMonthlyTopClients(workspaceId, new Date(startDate), new Date(endDate));
                res.json(monthlyData);
            }
            catch (error) {
                logger_1.default.error("Error getting monthly top clients:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to get monthly top clients",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
        this.analyticsService = new analytics_service_1.AnalyticsService();
    }
    /**
     * Calculate default date range: last 3 months including current month
     */
    getDefaultDateRange() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-based (0 = January)
        // End of current month (last day)
        const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
        // Start of 3 months before current month (first day)
        const startDate = new Date(currentYear, currentMonth - 2, 1, 0, 0, 0, 0);
        return { startDate, endDate };
    }
    /**
     * Get top 10 searched products
     */
    getTopSearchedProducts(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.params.workspaceId;
                const period = req.query.period || "7days";
                const limit = Math.min(parseInt(req.query.limit || "10"), 100);
                logger_1.default.info("📊 getTopSearchedProducts called", {
                    workspaceId,
                    period,
                    limit,
                });
                const data = yield this.analyticsService.getTopSearchedProducts(workspaceId, period, limit);
                return res.json({
                    success: true,
                    data,
                    period,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                logger_1.default.error("❌ Error in getTopSearchedProducts:", error);
                return res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : "Internal server error",
                    message: "Failed to fetch top searched products",
                });
            }
        });
    }
    /**
     * Get search trends over time
     */
    getSearchTrends(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.params.workspaceId;
                const period = req.query.period || "7days";
                logger_1.default.info("📈 getSearchTrends called", {
                    workspaceId,
                    period,
                });
                const data = yield this.analyticsService.getSearchTrends(workspaceId, period);
                return res.json({
                    success: true,
                    data,
                    period,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                logger_1.default.error("❌ Error in getSearchTrends:", error);
                return res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : "Internal server error",
                    message: "Failed to fetch search trends",
                });
            }
        });
    }
}
exports.AnalyticsController = AnalyticsController;
/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardAnalytics:
 *       type: object
 *       properties:
 *         overview:
 *           type: object
 *           properties:
 *             totalOrders:
 *               type: number
 *               description: Total number of orders
 *             totalRevenue:
 *               type: number
 *               description: Total revenue generated
 *             totalCustomers:
 *               type: number
 *               description: Total number of customers
 *             totalMessages:
 *               type: number
 *               description: Total number of messages
 *             averageOrderValue:
 *               type: number
 *               description: Average value per order
 *         trends:
 *           type: object
 *           properties:
 *             orders:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MonthlyData'
 *             revenue:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MonthlyData'
 *             customers:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MonthlyData'
 *             messages:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MonthlyData'
 *         topProducts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductAnalytics'
 *         topCustomers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CustomerAnalytics'
 *         topSellers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SellerAnalytics'
 *
 *     MonthlyData:
 *       type: object
 *       properties:
 *         month:
 *           type: string
 *           description: Month name (Jan, Feb, etc.)
 *         year:
 *           type: number
 *           description: Year
 *         value:
 *           type: number
 *           description: Metric value for the month
 *         label:
 *           type: string
 *           description: Display label (e.g., "Jan 2024")
 *
 *     ProductAnalytics:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Product ID
 *         name:
 *           type: string
 *           description: Product name
 *         totalSold:
 *           type: number
 *           description: Total units sold
 *         revenue:
 *           type: number
 *           description: Total revenue from this product
 *         stock:
 *           type: number
 *           description: Current stock level
 *
 *     CustomerAnalytics:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Customer ID
 *         name:
 *           type: string
 *           description: Customer name
 *         email:
 *           type: string
 *           description: Customer email
 *         phone:
 *           type: string
 *           description: Customer phone
 *         company:
 *           type: string
 *           description: Customer company
 *         totalOrders:
 *           type: number
 *           description: Total number of orders
 *         totalSpent:
 *           type: number
 *           description: Total amount spent
 *         lastOrderDate:
 *           type: string
 *           description: Date of last order
 *         averageOrderValue:
 *           type: number
 *           description: Average order value
 *
 *     SellerAnalytics:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Seller ID
 *         firstName:
 *           type: string
 *           description: Seller first name
 *         lastName:
 *           type: string
 *           description: Seller last name
 *         email:
 *           type: string
 *           description: Seller email
 *         phone:
 *           type: string
 *           description: Seller phone
 *         totalCustomers:
 *           type: number
 *           description: Total number of customers assigned
 *         totalOrders:
 *           type: number
 *           description: Total number of orders from assigned customers
 *         totalRevenue:
 *           type: number
 *           description: Total revenue generated from assigned customers
 *
 * tags:
 *   - name: Analytics
 *     description: Analytics and dashboard metrics endpoints
 */
//# sourceMappingURL=analytics.controller.js.map