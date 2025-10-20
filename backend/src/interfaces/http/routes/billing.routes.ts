import express from "express"
import { authMiddleware } from "../../../middlewares/auth.middleware"
import { BillingController } from "../controllers/billing.controller"

const router = express.Router()
const billingController = new BillingController()

// Protect all billing routes with authentication
// Note: workspaceId validation is done in controller since it comes from route params
router.use(authMiddleware)

/**
 * @route GET /api/billing/:workspaceId/totals
 * @desc Get current billing totals for a workspace
 * @query customerId (optional) - Get totals for specific customer
 */
router.get("/:workspaceId/totals", (req, res) => {
  billingController.getTotals(req, res)
})

/**
 * @route GET /api/billing/:workspaceId/summary
 * @desc Get detailed billing summary for a workspace
 */
router.get("/:workspaceId/summary", (req, res) => {
  billingController.getSummary(req, res)
})

/**
 * @route GET /api/billing/:workspaceId/history
 * @desc Get billing history in simple format: current + new = total
 * @query customerId (optional) - Get history for specific customer
 * @query limit (optional, default 50) - Number of records to return
 */
router.get("/:workspaceId/history", (req, res) => {
  billingController.getHistory(req, res)
})

/**
 * @route GET /api/billing/:workspaceId/monthly
 * @desc Get monthly billing breakdown for current month + 12 months history
 * @returns Monthly breakdown with totals per billing type
 */
router.get("/:workspaceId/monthly", (req, res) => {
  billingController.getMonthlyBreakdown(req, res)
})

/**
 * @route GET /api/billing/:workspaceId/monthly/:year/:month
 * @desc Get detailed billing records for a specific month
 * @param year - Year (e.g., 2025)
 * @param month - Month 1-12
 */
router.get("/:workspaceId/monthly/:year/:month", (req, res) => {
  billingController.getMonthDetail(req, res)
})

export { router as billingRouter }
