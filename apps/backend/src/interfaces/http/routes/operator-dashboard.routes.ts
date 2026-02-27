/**
 * Operator Dashboard Routes
 *
 * Token-based (no login) routes for the operator selection dashboard.
 * The operator sees the queue of waiting customers with AI summaries
 * and can choose who to handle first.
 *
 * Auth: operator_dashboard token (workspace-level, 48h)
 * Rate limit: 30 req/min
 */

import { Router } from "express"
import rateLimit from "express-rate-limit"
import { operatorDashboardController } from "../controllers/operator-dashboard.controller"
import logger from "../../../utils/logger"

const router = Router()

// Rate limiter: 30 req/min (dashboard polling is sparse)
const dashboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "RATE_LIMIT_EXCEEDED", message: "Too many requests." },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * @swagger
 * /api/v1/operator-dashboard/queue:
 *   get:
 *     summary: Get waiting customers queue with AI summaries
 *     description: Returns all customers waiting in the operator queue, each enriched with an on-demand AI summary of their last messages.
 *     tags: [Operator Dashboard]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: operator_dashboard token (workspace-level, 48h)
 *     responses:
 *       200:
 *         description: List of waiting customers with AI summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   customerId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   phone:
 *                     type: string
 *                     nullable: true
 *                   channel:
 *                     type: string
 *                     nullable: true
 *                     enum: [whatsapp, widget]
 *                   position:
 *                     type: integer
 *                   waitMinutes:
 *                     type: integer
 *                   aiSummary:
 *                     type: string
 *       400:
 *         description: Token missing
 *       401:
 *         description: Invalid or expired token
 */
router.get(
  "/queue",
  dashboardLimiter,
  operatorDashboardController.getQueue.bind(operatorDashboardController)
)

/**
 * @swagger
 * /api/v1/operator-dashboard/assign:
 *   post:
 *     summary: Assign a customer to operator (pick from queue)
 *     description: Creates a support_chat token for the chosen customer so the operator can open the direct chat page.
 *     tags: [Operator Dashboard]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, customerId]
 *             properties:
 *               token:
 *                 type: string
 *                 description: operator_dashboard token
 *               customerId:
 *                 type: string
 *                 description: ID of the customer to assign
 *     responses:
 *       200:
 *         description: Support chat token and URL returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: support_chat token (48h)
 *                 chatUrl:
 *                   type: string
 *                   description: Direct URL to operator chat page
 *       400:
 *         description: Missing params or customer not in queue
 *       401:
 *         description: Invalid or expired token
 */
router.post(
  "/assign",
  dashboardLimiter,
  operatorDashboardController.assignCustomer.bind(operatorDashboardController)
)

export const operatorDashboardRoutes = router

logger.info("✅ Operator-dashboard routes loaded (2 endpoints, token-auth)")
