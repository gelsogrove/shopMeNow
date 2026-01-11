/**
 * Owner Billing Routes
 * Feature 198: Billing Owner Refactor
 *
 * CRITICAL: Billing is per OWNER (User), not per Workspace!
 * These routes use userId from JWT token, NO workspaceId required.
 *
 * ARCHITECTURE: JWT Token Only (No SessionId) - See spec #183
 * Routes use ONLY authMiddleware for JWT validation.
 *
 * Routes:
 * - GET  /api/subscription-billing                    - Get billing overview for user
 * - GET  /api/subscription-billing/balance            - Quick balance check
 * - GET  /api/subscription-billing/transactions       - Transaction history
 * - GET  /api/subscription-billing/status             - Subscription status
 * - POST /api/subscription-billing/recharge           - Recharge credit
 * - POST /api/subscription-billing/pause              - Pause subscription
 * - POST /api/subscription-billing/resume             - Resume subscription
 * - POST /api/subscription-billing/upgrade            - Upgrade plan
 * - POST /api/subscription-billing/downgrade          - Schedule downgrade
 * - DELETE /api/subscription-billing/pending-change   - Cancel pending plan change
 */

import { Router } from "express"
import { prisma } from "@echatbot/database"
import { SubscriptionBillingController } from "../controllers/subscription-billing.controller"
import { authMiddleware } from "../middlewares/auth.middleware"

const controller = new SubscriptionBillingController(prisma)

export const ownerBillingRoutes = Router()

// All routes require auth (userId from JWT token)
// NO workspace validation needed - billing is per owner
// NO sessionId validation - JWT only (spec #183)

/**
 * @swagger
 * /api/subscription-billing:
 *   get:
 *     summary: Get billing overview for authenticated user (Owner)
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing overview with plan info, credit balance, usage stats
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
ownerBillingRoutes.get(
  "/",
  authMiddleware,
  controller.getOwnerBillingOverview
)

/**
 * @swagger
 * /api/subscription-billing/balance:
 *   get:
 *     summary: Get current credit balance for authenticated user
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current credit balance and low balance warning
 */
ownerBillingRoutes.get(
  "/balance",
  authMiddleware,
  controller.getOwnerBalance
)

/**
 * @swagger
 * /api/subscription-billing/status:
 *   get:
 *     summary: Get subscription status for authenticated user
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status including pause state, pending changes
 */
ownerBillingRoutes.get(
  "/status",
  authMiddleware,
  controller.getOwnerSubscriptionStatus
)

/**
 * @swagger
 * /api/subscription-billing/transactions:
 *   get:
 *     summary: Get transaction history for authenticated user
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [MESSAGE, PUSH_NOTIFICATION, RECHARGE, MONTHLY_FEE, UPGRADE_FEE, ADJUSTMENT]
 *     responses:
 *       200:
 *         description: Paginated transaction history
 */
ownerBillingRoutes.get(
  "/transactions",
  authMiddleware,
  controller.getOwnerTransactions
)

/**
 * @swagger
 * /api/subscription-billing/recharge:
 *   post:
 *     summary: Recharge credit for authenticated user
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 10
 *                 maximum: 1000
 *     responses:
 *       200:
 *         description: Recharge successful
 *       400:
 *         description: Invalid amount
 */
ownerBillingRoutes.post(
  "/recharge",
  authMiddleware,
  controller.rechargeOwnerCredit
)

/**
 * @swagger
 * /api/subscription-billing/pause:
 *   post:
 *     summary: Pause subscription (effective from 1st of next month)
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pause scheduled
 *       400:
 *         description: Already paused or invalid state
 */
ownerBillingRoutes.post(
  "/pause",
  authMiddleware,
  controller.pauseOwnerSubscription
)

/**
 * @swagger
 * /api/subscription-billing/resume:
 *   post:
 *     summary: Resume a paused subscription
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription resumed
 *       400:
 *         description: Not paused
 */
ownerBillingRoutes.post(
  "/resume",
  authMiddleware,
  controller.resumeOwnerSubscription
)

/**
 * @swagger
 * /api/subscription-billing/upgrade:
 *   post:
 *     summary: Upgrade subscription plan (immediate)
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planType
 *             properties:
 *               planType:
 *                 type: string
 *                 enum: [BASIC, PREMIUM, ENTERPRISE]
 *     responses:
 *       200:
 *         description: Upgrade successful
 *       400:
 *         description: Invalid plan or downgrade attempt
 */
ownerBillingRoutes.post(
  "/upgrade",
  authMiddleware,
  controller.upgradeOwnerPlan
)

/**
 * @swagger
 * /api/subscription-billing/downgrade:
 *   post:
 *     summary: Schedule plan downgrade (effective next billing cycle)
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPlan
 *             properties:
 *               newPlan:
 *                 type: string
 *                 enum: [BASIC, PREMIUM]
 *     responses:
 *       200:
 *         description: Downgrade scheduled
 *       400:
 *         description: Invalid downgrade or limits exceeded
 */
ownerBillingRoutes.post(
  "/downgrade",
  authMiddleware,
  controller.scheduleOwnerDowngrade
)

/**
 * @swagger
 * /api/subscription-billing/pending-change:
 *   delete:
 *     summary: Cancel pending plan change (downgrade)
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending change cancelled
 *       400:
 *         description: No pending change
 */
ownerBillingRoutes.delete(
  "/pending-change",
  authMiddleware,
  controller.cancelOwnerPendingChange
)

/**
 * @swagger
 * /api/subscription-billing/invoices:
 *   get:
 *     summary: Get invoice history for authenticated user
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: List of invoices
 */
ownerBillingRoutes.get(
  "/invoices",
  authMiddleware,
  controller.getOwnerInvoices
)

/**
 * @swagger
 * /api/subscription-billing/invoices/current:
 *   get:
 *     summary: Get current month's invoice (draft) with consumption breakdown
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current month invoice with real-time consumption
 */
ownerBillingRoutes.get(
  "/invoices/current",
  authMiddleware,
  controller.getCurrentInvoice
)

/**
 * @swagger
 * /api/subscription-billing/invoices/{invoiceId}:
 *   get:
 *     summary: Get specific invoice by ID
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice details
 *       404:
 *         description: Invoice not found
 */
ownerBillingRoutes.get(
  "/invoices/:invoiceId",
  authMiddleware,
  controller.getInvoiceById
)

/**
 * @swagger
 * /api/subscription-billing/invoices/{invoiceId}/pdf:
 *   get:
 *     summary: Download invoice PDF
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice PDF
 *       404:
 *         description: Invoice not found
 */
ownerBillingRoutes.get(
  "/invoices/:invoiceId/pdf",
  authMiddleware,
  controller.downloadInvoicePdf
)

/**
 * @swagger
 * /api/subscription-billing/invoices/{invoiceId}/credit-notes/{noteId}/pdf:
 *   get:
 *     summary: Download credit note PDF
 *     tags: [Owner Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credit note PDF
 *       404:
 *         description: Credit note not found
 */
ownerBillingRoutes.get(
  "/invoices/:invoiceId/credit-notes/:noteId/pdf",
  authMiddleware,
  controller.downloadCreditNotePdf
)
