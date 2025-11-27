/**
 * Subscription Billing Controller
 * Feature 185: Subscription & Billing System
 *
 * API endpoints for:
 * - GET /billing - Get billing overview
 * - GET /billing/balance - Quick balance check
 * - GET /billing/transactions - Transaction history
 * - POST /billing/recharge - Recharge credit (Owner only)
 * - POST /billing/upgrade - Upgrade plan (Owner only)
 * - GET /billing/plans - Get available plans (public)
 *
 * SECURITY:
 * - All workspace-specific endpoints require workspaceId validation
 * - Recharge and Upgrade require Owner role
 */

import { Request, Response } from "express"
import { PrismaClient, TransactionType } from "@prisma/client"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import logger from "../../../utils/logger"

export class SubscriptionBillingController {
  private billingService: SubscriptionBillingService

  constructor(private prisma: PrismaClient) {
    this.billingService = new SubscriptionBillingService(prisma)
  }

  /**
   * GET /billing
   * Get complete billing overview for workspace
   * Includes: plan info, credit balance, usage stats, limits
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing:
   *   get:
   *     summary: Get billing overview
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
   *         name: x-session-id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Billing overview
   *       401:
   *         description: Unauthorized
   */
  getBillingOverview = async (req: Request, res: Response): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId

      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" })
        return
      }

      const overview = await this.billingService.getBillingOverview(workspaceId)

      res.json({
        success: true,
        data: overview,
      })
    } catch (error) {
      logger.error("[BILLING] Error getting billing overview:", error)
      res.status(500).json({
        error: "Errore recupero informazioni billing",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /billing/balance
   * Quick credit balance check (for header display)
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/balance:
   *   get:
   *     summary: Get current credit balance
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
   *         description: Credit balance
   */
  getBalance = async (req: Request, res: Response): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId

      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" })
        return
      }

      const balance = await this.billingService.getCreditBalance(workspaceId)

      // Also get trial info and plan type for header display
      const trialInfo = await this.billingService.isTrialValid(workspaceId)
      
      // Get plan type from billing overview
      const overview = await this.billingService.getBillingOverview(workspaceId)

      res.json({
        success: true,
        data: {
          creditBalance: balance,
          planType: overview.billing.planType,
          isLowBalance: balance < overview.limits.lowBalanceThreshold,
          trialInfo: trialInfo.isTrialPlan
            ? {
                isTrialPlan: true,
                daysRemaining: trialInfo.daysRemaining,
                isExpired: !trialInfo.isValid,
              }
            : null,
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error getting balance:", error)
      res.status(500).json({
        error: "Errore recupero saldo",
      })
    }
  }

  /**
   * GET /billing/transactions
   * Get transaction history with pagination
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/transactions:
   *   get:
   *     summary: Get transaction history
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
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [MESSAGE, PUSH_NOTIFICATION, RECHARGE, MONTHLY_FEE, UPGRADE_FEE]
   *     responses:
   *       200:
   *         description: Transaction history
   */
  getTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId

      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" })
        return
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100) // Max 100
      const type = req.query.type as TransactionType | undefined

      // Parse date filters
      let startDate: Date | undefined
      let endDate: Date | undefined

      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string)
      }
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string)
      }

      const result = await this.billingService.getTransactionHistory(
        workspaceId,
        {
          page,
          limit,
          type,
          startDate,
          endDate,
        }
      )

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error("[BILLING] Error getting transactions:", error)
      res.status(500).json({
        error: "Errore recupero storico transazioni",
      })
    }
  }

  /**
   * POST /billing/recharge
   * Recharge credit (Owner only)
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/recharge:
   *   post:
   *     summary: Recharge credit
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
   *     responses:
   *       200:
   *         description: Recharge successful
   *       402:
   *         description: Payment required (simulated)
   *       403:
   *         description: Owner role required
   */
  rechargeCredit = async (req: Request, res: Response): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId
      const { amount } = req.body

      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" })
        return
      }

      // Validate amount
      if (!amount || typeof amount !== "number") {
        res.status(400).json({
          error: "Importo richiesto",
          code: "AMOUNT_REQUIRED",
        })
        return
      }

      if (amount < 10) {
        res.status(400).json({
          error: "Importo minimo €10",
          code: "AMOUNT_TOO_LOW",
        })
        return
      }

      if (amount > 1000) {
        res.status(400).json({
          error: "Importo massimo €1000",
          code: "AMOUNT_TOO_HIGH",
        })
        return
      }

      // Perform recharge (simulated payment - always succeeds)
      // If on FREE_TRIAL, auto-upgrades to BASIC
      const result = await this.billingService.rechargeCredit(
        workspaceId,
        amount
      )

      if (result.upgradedToPlan) {
        logger.info(
          `[BILLING] 🎉 Auto-upgraded to ${result.upgradedToPlan} on recharge (workspace: ${workspaceId})`
        )
      }

      logger.info(
        `[BILLING] 💰 Recharge successful: +€${amount.toFixed(2)} (workspace: ${workspaceId})`
      )

      res.json({
        success: true,
        message: result.upgradedToPlan 
          ? `Ricarica di €${amount.toFixed(2)} completata! Piano aggiornato a ${result.upgradedToPlan}.`
          : `Ricarica di €${amount.toFixed(2)} completata con successo!`,
        data: {
          newBalance: result.newBalance,
          amountCharged: amount,
          upgradedToPlan: result.upgradedToPlan,
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error recharging credit:", error)
      res.status(500).json({
        error: "Credit recharge error",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * POST /billing/upgrade
   * Upgrade plan (Owner only)
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/upgrade:
   *   post:
   *     summary: Upgrade plan
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
   *     responses:
   *       200:
   *         description: Upgrade successful
   *       403:
   *         description: Owner role required or invalid upgrade
   */
  upgradePlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId
      const { planType } = req.body

      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" })
        return
      }

      // Validate plan type
      const validPlans = ["BASIC", "PREMIUM", "ENTERPRISE"]
      if (!planType || !validPlans.includes(planType)) {
        res.status(400).json({
          error: "Piano non valido",
          code: "INVALID_PLAN",
          validPlans,
        })
        return
      }

      const result = await this.billingService.upgradePlan(
        workspaceId,
        planType
      )

      logger.info(
        `[BILLING] 📈 Plan upgraded to ${planType} (workspace: ${workspaceId})`
      )

      res.json({
        success: true,
        message: `Upgrade to ${result.newPlan.displayName} completed!`,
        data: {
          newPlan: result.newPlan,
          nextBillingDate: result.nextBillingDate,
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error upgrading plan:", error)

      // Handle specific errors
      if (error instanceof Error) {
        if (
          error.message.includes("Cannot downgrade") ||
          error.message.includes("Cannot upgrade to Free Trial")
        ) {
          res.status(400).json({
            error: error.message,
            code: "INVALID_UPGRADE",
          })
          return
        }
      }

      res.status(500).json({
        error: "Errore upgrade piano",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * POST /billing/change-plan
   * Change workspace plan (upgrade or downgrade)
   * For downgrade: validates current usage fits within target plan limits
   * OWNER-ONLY
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/change-plan:
   *   post:
   *     summary: Change workspace plan (upgrade or downgrade)
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
   *             properties:
   *               planType:
   *                 type: string
   *                 enum: [BASIC, PREMIUM, ENTERPRISE]
   *     responses:
   *       200:
   *         description: Plan changed successfully
   *       400:
   *         description: Invalid plan or usage exceeds target plan limits
   */
  changePlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId
      const { planType } = req.body

      if (!workspaceId) {
        res.status(400).json({ error: "Workspace ID required" })
        return
      }

      // Validate plan type
      const validPlans = ["BASIC", "PREMIUM", "ENTERPRISE"]
      if (!planType || !validPlans.includes(planType)) {
        res.status(400).json({
          error: "Piano non valido",
          code: "INVALID_PLAN",
          validPlans,
        })
        return
      }

      const result = await this.billingService.changePlan(
        workspaceId,
        planType
      )

      const action = result.isDowngrade ? "Downgrade" : "Upgrade"
      logger.info(
        `[BILLING] ${result.isDowngrade ? "📉" : "📈"} Plan changed to ${planType} (workspace: ${workspaceId})`
      )

      res.json({
        success: true,
        message: `${action} a ${result.newPlan.displayName} completato!`,
        data: {
          newPlan: result.newPlan,
          nextBillingDate: result.nextBillingDate,
          isDowngrade: result.isDowngrade,
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error changing plan:", error)

      // Handle specific errors
      if (error instanceof Error) {
        if (
          error.message.includes("Cannot downgrade") ||
          error.message.includes("Cannot change to Free Trial") ||
          error.message.includes("Already on")
        ) {
          res.status(400).json({
            error: error.message,
            code: "INVALID_PLAN_CHANGE",
          })
          return
        }
      }

      res.status(500).json({
        error: "Errore cambio piano",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /billing/plans
   * Get all available plans (public endpoint for plan comparison)
   *
   * @swagger
   * /api/billing/plans:
   *   get:
   *     summary: Get available plans
   *     tags: [Billing]
   *     responses:
   *       200:
   *         description: List of available plans
   */
  getAvailablePlans = async (req: Request, res: Response): Promise<void> => {
    try {
      const plans = await this.billingService.getAvailablePlans()

      res.json({
        success: true,
        data: plans,
      })
    } catch (error) {
      logger.error("[BILLING] Error getting plans:", error)
      res.status(500).json({
        error: "Errore recupero piani",
      })
    }
  }
}
