import { Request, Response } from "express"
import { AnalyticsService } from "../../../application/services/analytics.service"
import logger from "../../../utils/logger"

export class AnalyticsController {
  private analyticsService: AnalyticsService

  constructor() {
    this.analyticsService = new AnalyticsService()
  }

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
  getDashboardData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { workspaceId } = req.params
      const { startDate, endDate } = req.query

      // Default to last 3 complete months (excluding current month)
      const defaultDateRange = this.getDefaultDateRange()

      const dateFrom = startDate
        ? new Date(startDate as string)
        : defaultDateRange.startDate
      const dateTo = endDate
        ? new Date(endDate as string)
        : defaultDateRange.endDate

      const analyticsData = await this.analyticsService.getDashboardAnalytics(
        workspaceId,
        dateFrom,
        dateTo
      )

      res.json({
        success: true,
        data: analyticsData,
        dateRange: {
          startDate: dateFrom,
          endDate: dateTo,
          isDefault: !startDate && !endDate,
          note:
            !startDate && !endDate
              ? "Default range: last 3 complete months (excluding current month)"
              : null,
        },
      })
    } catch (error) {
      logger.error("Error getting dashboard data:", error)
      res.status(500).json({
        success: false,
        message: "Failed to get dashboard analytics data",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

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
  getDetailedMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { workspaceId } = req.params
      const { startDate, endDate, metric } = req.query

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: "Start date and end date are required for detailed metrics",
        })
        return
      }

      const detailedData = await this.analyticsService.getDetailedMetrics(
        workspaceId,
        new Date(startDate as string),
        new Date(endDate as string),
        metric as string
      )

      res.json({
        success: true,
        data: detailedData,
      })
    } catch (error) {
      logger.error("Error getting detailed metrics:", error)
      res.status(500).json({
        success: false,
        message: "Failed to get detailed metrics",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

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
  getMonthlyTopCustomers = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { workspaceId } = req.params
      const { startDate, endDate } = req.query

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: "Start date and end date are required",
        })
        return
      }

      const monthlyData = await this.analyticsService.getMonthlyTopCustomers(
        workspaceId,
        new Date(startDate as string),
        new Date(endDate as string)
      )

      res.json(monthlyData)
    } catch (error) {
      logger.error("Error getting monthly top customers:", error)
      res.status(500).json({
        success: false,
        message: "Failed to get monthly top customers",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

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
  getMonthlyTopClients = async (req: Request, res: Response): Promise<void> => {
    try {
      const { workspaceId } = req.params
      const { startDate, endDate } = req.query

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: "Start date and end date are required",
        })
        return
      }

      const monthlyData = await this.analyticsService.getMonthlyTopClients(
        workspaceId,
        new Date(startDate as string),
        new Date(endDate as string)
      )

      res.json(monthlyData)
    } catch (error) {
      logger.error("Error getting monthly top clients:", error)
      res.status(500).json({
        success: false,
        message: "Failed to get monthly top clients",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * Calculate default date range: last 3 months including current month
   */
  private getDefaultDateRange(): { startDate: Date; endDate: Date } {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-based (0 = January)

    // End of current month (last day)
    const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)

    // Start of 3 months before current month (first day)
    const startDate = new Date(currentYear, currentMonth - 2, 1, 0, 0, 0, 0)

    return { startDate, endDate }
  }
}

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
