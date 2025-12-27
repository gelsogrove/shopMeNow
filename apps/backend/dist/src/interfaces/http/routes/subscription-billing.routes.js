"use strict";
/**
 * Subscription Billing Routes
 * Feature 185: Subscription & Billing System
 *
 * ARCHITECTURE: JWT Token Only (No SessionId) - See spec #183
 *
 * SECURITY MIDDLEWARE STACK:
 * - Public routes: None
 * - Read routes: authMiddleware → validateWorkspaceOperation
 * - Write routes (Owner): authMiddleware → validateWorkspaceOperation → requireOwnerForBilling
 *
 * Routes:
 * - GET  /api/billing/plans                              - Public: Get available plans
 * - GET  /api/workspaces/:workspaceId/billing            - Auth: Get billing overview
 * - GET  /api/workspaces/:workspaceId/billing/balance    - Auth: Quick balance check
 * - GET  /api/workspaces/:workspaceId/billing/transactions - Auth: Transaction history
 * - POST /api/workspaces/:workspaceId/billing/recharge   - Owner: Recharge credit
 * - POST /api/workspaces/:workspaceId/billing/upgrade    - Owner: Upgrade plan
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingRoutes = exports.publicBillingRoutes = void 0;
const express_1 = require("express");
const database_1 = require("@echatbot/database");
const subscription_billing_controller_1 = require("../controllers/subscription-billing.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../../../middlewares/workspace-validation.middleware");
const billing_middleware_1 = require("../middlewares/billing.middleware");
// prisma imported
const controller = new subscription_billing_controller_1.SubscriptionBillingController(database_1.prisma);
// ============================================================================
// PUBLIC ROUTES (no auth required)
// ============================================================================
exports.publicBillingRoutes = (0, express_1.Router)();
/**
 * @swagger
 * /api/billing/plans:
 *   get:
 *     summary: Get available subscription plans
 *     tags: [Billing]
 *     description: Public endpoint to view all available plans and their features
 *     responses:
 *       200:
 *         description: List of available plans
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
 *                     properties:
 *                       planType:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       monthlyFee:
 *                         type: number
 *                       maxChannels:
 *                         type: integer
 *                       maxProducts:
 *                         type: integer
 *                       maxCustomers:
 *                         type: integer
 */
exports.publicBillingRoutes.get("/plans", controller.getAvailablePlans);
// ============================================================================
// WORKSPACE-SCOPED ROUTES (auth required)
// ============================================================================
exports.billingRoutes = (0, express_1.Router)({ mergeParams: true });
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing:
 *   get:
 *     summary: Get billing overview for workspace
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Billing overview with plan info, credit balance, usage stats
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - no access to workspace
 */
exports.billingRoutes.get("/", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, controller.getBillingOverview);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/balance:
 *   get:
 *     summary: Get current credit balance (quick check for header)
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current credit balance and low balance warning
 */
exports.billingRoutes.get("/balance", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, controller.getBalance);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/transactions:
 *   get:
 *     summary: Get transaction history with pagination
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [MESSAGE, PUSH_NOTIFICATION, RECHARGE, MONTHLY_FEE, UPGRADE_FEE, ADJUSTMENT, INITIAL_CREDIT]
 *         description: Filter by transaction type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter from date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter to date
 *     responses:
 *       200:
 *         description: Paginated transaction history
 */
exports.billingRoutes.get("/transactions", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, controller.getTransactions);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/recharge:
 *   post:
 *     summary: Recharge credit (Owner only)
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
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
 *                 description: Amount to recharge in EUR
 *     responses:
 *       200:
 *         description: Recharge successful
 *       400:
 *         description: Invalid amount
 *       403:
 *         description: Owner role required
 */
exports.billingRoutes.post("/recharge", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, billing_middleware_1.requireOwnerForBilling, controller.rechargeCredit);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/upgrade:
 *   post:
 *     summary: Upgrade subscription plan (Owner only)
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
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
 *                 description: Target plan to upgrade to
 *     responses:
 *       200:
 *         description: Upgrade successful
 *       400:
 *         description: Invalid plan or downgrade attempt
 *       403:
 *         description: Owner role required
 */
exports.billingRoutes.post("/upgrade", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, billing_middleware_1.requireOwnerForBilling, controller.upgradePlan);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/change-plan:
 *   post:
 *     summary: Change plan (upgrade or downgrade)
 *     description: |
 *       Changes workspace subscription plan. For downgrades, validates that current usage
 *       (products, customers, channels) fits within target plan limits.
 *       Fee will be charged at next billing date (30 days).
 *       OWNER-ONLY operation.
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-workspace-id
 *         required: true
 *         schema:
 *           type: string
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
 *                 description: Target plan to change to
 *     responses:
 *       200:
 *         description: Plan changed successfully
 *       400:
 *         description: Invalid plan or usage exceeds target plan limits (for downgrade)
 *       403:
 *         description: Owner role required
 */
exports.billingRoutes.post("/change-plan", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, billing_middleware_1.requireOwnerForBilling, controller.changePlan);
// ============================================================================
// Feature 197: Subscription Management Routes
// ============================================================================
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/subscription/status:
 *   get:
 *     summary: Get subscription status
 *     description: Get detailed subscription status including pause state, pending changes, and block reasons
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription status
 */
exports.billingRoutes.get("/subscription/status", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, controller.getSubscriptionStatus);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/subscription/pause:
 *   post:
 *     summary: Pause subscription
 *     description: |
 *       Request to pause subscription. Effective from 1st of next month.
 *       Chatbot will stop responding. Data is retained.
 *       OWNER-ONLY operation.
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pause scheduled
 *       400:
 *         description: Already paused or invalid state
 *       403:
 *         description: Owner role required
 */
exports.billingRoutes.post("/subscription/pause", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, billing_middleware_1.requireOwnerForBilling, controller.pauseSubscription);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/subscription/resume:
 *   post:
 *     summary: Resume subscription
 *     description: |
 *       Resume a paused subscription or cancel a pending pause.
 *       Chatbot will start responding again immediately.
 *       OWNER-ONLY operation.
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription resumed
 *       400:
 *         description: Not paused
 *       403:
 *         description: Owner role required
 */
exports.billingRoutes.post("/subscription/resume", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, billing_middleware_1.requireOwnerForBilling, controller.resumeSubscription);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/plan/downgrade:
 *   post:
 *     summary: Schedule plan downgrade
 *     description: |
 *       Schedule a downgrade for next billing cycle.
 *       Validates that current usage fits within target plan limits.
 *       OWNER-ONLY operation.
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
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
 *       403:
 *         description: Owner role required
 */
exports.billingRoutes.post("/plan/downgrade", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, billing_middleware_1.requireOwnerForBilling, controller.scheduleDowngrade);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/billing/plan/pending:
 *   delete:
 *     summary: Cancel pending plan change
 *     description: |
 *       Cancel a scheduled downgrade before it takes effect.
 *       OWNER-ONLY operation.
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending change cancelled
 *       400:
 *         description: No pending change
 *       403:
 *         description: Owner role required
 */
exports.billingRoutes.delete("/plan/pending", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, billing_middleware_1.requireOwnerForBilling, controller.cancelPendingPlanChange);
//# sourceMappingURL=subscription-billing.routes.js.map