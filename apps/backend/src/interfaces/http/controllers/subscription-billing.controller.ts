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
import { PrismaClient, TransactionType } from "@echatbot/database"
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

      logger.info(`[BILLING] getBillingOverview called for workspace: ${workspaceId}`)
      const overview = await this.billingService.getBillingOverview(workspaceId)
      logger.info(`[BILLING] Overview retrieved:`, { 
        hasBilling: !!overview.billing, 
        hasLimits: !!overview.limits,
        hasUsage: !!overview.usage,
        limits: overview.limits
      })

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
          lowBalanceThreshold: overview.limits.lowBalanceThreshold,
          creditMinThreshold: overview.thresholds.creditMinThreshold,
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

  // ============================================================================
  // Feature 197: Subscription Management Endpoints
  // ============================================================================

  /**
   * POST /billing/subscription/pause
   * Request to pause subscription (effective next billing cycle)
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/subscription/pause:
   *   post:
   *     summary: Pause subscription
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
   */
  pauseSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
      // Feature 198: Use userId from token for owner-based billing
      const userId = (req as any).user?.id
      const workspaceId = (req as any).workspaceId || req.params.workspaceId

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      // Get owner billing status from User
      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          subscriptionStatus: true,
          planType: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      // Validate current status
      if (owner.subscriptionStatus === "PAUSED") {
        res.status(400).json({
          error: "Abbonamento già in pausa",
          code: "ALREADY_PAUSED",
        })
        return
      }

      // IMMEDIATE pause - chatbots stop responding NOW
      const now = new Date()

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: "PAUSED",
          pauseRequestedAt: now,
          pausedAt: now,
        },
      })

      logger.info(
        `[BILLING] ⏸️ Subscription PAUSED IMMEDIATELY for owner ${owner.firstName} (userId: ${userId})`
      )

      res.json({
        success: true,
        message: "Abbonamento in pausa. I chatbot di tutti i workspace hanno smesso di rispondere.",
        data: {
          effectiveDate: now.toISOString(),
          currentStatus: "PAUSED",
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error pausing subscription:", error)
      res.status(500).json({
        error: "Errore durante la pausa dell'abbonamento",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * POST /billing/subscription/resume
   * Resume a paused subscription
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/subscription/resume:
   *   post:
   *     summary: Resume subscription
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
   */
  resumeSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
      // Feature 198: Use userId from token for owner-based billing
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          subscriptionStatus: true,
          planType: true,
          pausedAt: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      // Can only resume from PAUSED
      if (owner.subscriptionStatus !== "PAUSED") {
        res.status(400).json({
          error: "L'abbonamento non è in pausa",
          code: "NOT_PAUSED",
        })
        return
      }

      // Resume subscription on User (affects all owner's workspaces)
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: "ACTIVE",
          pausedAt: null,
          pauseRequestedAt: null,
        },
      })

      logger.info(`[BILLING] ▶️ Subscription resumed for owner ${owner.firstName} (userId: ${userId})`)

      res.json({
        success: true,
        message: "Abbonamento riattivato! I chatbot di tutti i workspace torneranno a rispondere.",
        data: {
          currentStatus: "ACTIVE",
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error resuming subscription:", error)
      res.status(500).json({
        error: "Errore durante la riattivazione dell'abbonamento",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * POST /billing/plan/downgrade
   * Schedule a downgrade (effective next billing cycle)
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/plan/downgrade:
   *   post:
   *     summary: Schedule plan downgrade
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
   *               newPlan:
   *                 type: string
   *                 enum: [BASIC, PREMIUM]
   *     responses:
   *       200:
   *         description: Downgrade scheduled
   *       400:
   *         description: Invalid downgrade or limits exceeded
   */
  scheduleDowngrade = async (req: Request, res: Response): Promise<void> => {
    try {
      // Feature 198: Use userId from token for owner-based billing
      const userId = (req as any).user?.id
      const workspaceId = (req as any).workspaceId || req.params.workspaceId
      const { newPlan } = req.body

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      if (!newPlan) {
        res.status(400).json({ error: "New plan required" })
        return
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          planType: true,
          pendingPlanType: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      // Validate it's a downgrade
      const planOrder = ["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"]
      const currentIndex = planOrder.indexOf(owner.planType)
      const newIndex = planOrder.indexOf(newPlan)

      if (newIndex >= currentIndex) {
        res.status(400).json({
          error: "Questo non è un downgrade. Usa l'endpoint upgrade per passare a un piano superiore.",
          code: "NOT_A_DOWNGRADE",
        })
        return
      }

      // Check plan limits before scheduling (use workspaceId for resource counting)
      const newPlanConfig = await this.prisma.planConfiguration.findUnique({
        where: { planType: newPlan },
      })

      if (!newPlanConfig) {
        res.status(400).json({ error: "Piano non trovato" })
        return
      }

      // Get current usage across ALL owner's workspaces
      const ownerWorkspaces = await this.prisma.workspace.findMany({
        where: { ownerId: userId },
        select: { id: true },
      })
      const workspaceIds = ownerWorkspaces.map((w) => w.id)

      const customerCount = await this.prisma.customers.count({
        where: { workspaceId: { in: workspaceIds }, deletedAt: null },
      })

      if (customerCount > newPlanConfig.maxCustomers) {
        res.status(400).json({
          error: `Hai ${customerCount} clienti totali, ma il piano ${newPlanConfig.displayName} ne permette solo ${newPlanConfig.maxCustomers}. Non è possibile fare il downgrade.`,
          code: "CUSTOMERS_EXCEED_LIMIT",
          details: {
            current: customerCount,
            limit: newPlanConfig.maxCustomers,
          },
        })
        return
      }

      // Schedule downgrade for next month on User (affects all workspaces)
      const effectiveDate = new Date()
      effectiveDate.setMonth(effectiveDate.getMonth() + 1)
      effectiveDate.setDate(1)
      effectiveDate.setHours(0, 0, 0, 0)

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pendingPlanType: newPlan,
          pendingPlanEffectiveDate: effectiveDate,
        },
      })

      logger.info(
        `[BILLING] 📋 Downgrade scheduled for owner ${owner.firstName}: ${owner.planType} → ${newPlan} on ${effectiveDate.toISOString()}`
      )

      res.json({
        success: true,
        message: `Downgrade a ${newPlanConfig.displayName} programmato per il 1° del prossimo mese. Riguarderà tutti i tuoi workspace.`,
        data: {
          currentPlan: owner.planType,
          pendingPlan: newPlan,
          effectiveDate: effectiveDate.toISOString(),
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error scheduling downgrade:", error)
      res.status(500).json({
        error: "Errore durante la programmazione del downgrade",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * DELETE /billing/plan/pending
   * Cancel a pending plan change (downgrade)
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/plan/pending:
   *   delete:
   *     summary: Cancel pending plan change
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
   */
  cancelPendingPlanChange = async (req: Request, res: Response): Promise<void> => {
    try {
      // Feature 198: Use userId from token for owner-based billing
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          pendingPlanType: true,
          pendingPlanEffectiveDate: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      if (!owner.pendingPlanType) {
        res.status(400).json({
          error: "Nessun cambio piano in sospeso",
          code: "NO_PENDING_CHANGE",
        })
        return
      }

      const cancelledPlan = owner.pendingPlanType

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pendingPlanType: null,
          pendingPlanEffectiveDate: null,
        },
      })

      logger.info(`[BILLING] ❌ Pending downgrade cancelled for owner ${owner.firstName}`)

      res.json({
        success: true,
        message: `Downgrade a ${cancelledPlan} annullato.`,
        data: {
          cancelledPlan,
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error cancelling pending plan:", error)
      res.status(500).json({
        error: "Errore durante l'annullamento del cambio piano",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /billing/subscription/status
   * Get current subscription status and access info
   *
   * @swagger
   * /api/workspaces/{workspaceId}/billing/subscription/status:
   *   get:
   *     summary: Get subscription status
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
  getSubscriptionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      // Feature 198: Use userId from token for owner-based billing
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionStatus: true,
          creditBalance: true,
          pausedAt: true,
          pauseRequestedAt: true,
          pendingPlanType: true,
          pendingPlanEffectiveDate: true,
          lastPaymentFailedAt: true,
          paymentFailureCount: true,
          nextBillingDate: true,
          planType: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      // Determine if service is blocked
      const creditBalance = Number(owner.creditBalance)
      const CREDIT_MIN_THRESHOLD = -10
      const isBlocked =
        owner.subscriptionStatus === "PAUSED" ||
        owner.subscriptionStatus === "PAYMENT_FAILED" ||
        creditBalance < CREDIT_MIN_THRESHOLD

      res.json({
        success: true,
        data: {
          subscriptionStatus: owner.subscriptionStatus,
          creditBalance,
          isBlocked,
          blockReason: isBlocked
            ? owner.subscriptionStatus === "PAUSED"
              ? "PAUSED"
              : owner.subscriptionStatus === "PAYMENT_FAILED"
                ? "PAYMENT_FAILED"
                : creditBalance < CREDIT_MIN_THRESHOLD
                  ? "CREDIT_EXHAUSTED"
                  : null
            : null,
          pausedAt: owner.pausedAt,
          pauseRequestedAt: owner.pauseRequestedAt,
          pendingPlanType: owner.pendingPlanType,
          pendingPlanEffectiveDate: owner.pendingPlanEffectiveDate,
          lastPaymentFailedAt: owner.lastPaymentFailedAt,
          paymentFailureCount: owner.paymentFailureCount,
          nextBillingDate: owner.nextBillingDate,
          planType: owner.planType,
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error getting subscription status:", error)
      res.status(500).json({
        error: "Errore recupero stato abbonamento",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // ===========================================================================
  // OWNER-BASED ROUTES (Feature 198) - No workspaceId required
  // These routes use userId from JWT token only
  // ===========================================================================

  /**
   * GET /subscription-billing
   * Get billing overview for authenticated owner (user)
   */
  getOwnerBillingOverview = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const overview = await this.billingService.getOwnerBillingOverview(userId)

      res.json({
        success: true,
        data: overview,
      })
    } catch (error) {
      logger.error("[BILLING] Error getting owner billing overview:", error)
      res.status(500).json({
        error: "Errore recupero informazioni billing",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /subscription-billing/balance
   * Quick credit balance check for owner
   */
  getOwnerBalance = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          creditBalance: true,
          planType: true,
          subscriptionStatus: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      const creditBalance = Number(owner.creditBalance)
      const LOW_BALANCE_WARNING = 5

      res.json({
        success: true,
        data: {
          creditBalance,
          planType: owner.planType,
          subscriptionStatus: owner.subscriptionStatus,
          isLowBalance: creditBalance < LOW_BALANCE_WARNING,
          isCritical: creditBalance < 0,
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error getting owner balance:", error)
      res.status(500).json({
        error: "Errore recupero saldo",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /subscription-billing/status
   * Get subscription status for owner
   */
  getOwnerSubscriptionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionStatus: true,
          creditBalance: true,
          pausedAt: true,
          pauseRequestedAt: true,
          pendingPlanType: true,
          pendingPlanEffectiveDate: true,
          lastPaymentFailedAt: true,
          paymentFailureCount: true,
          nextBillingDate: true,
          planType: true,
          trialEndsAt: true,
          planStartedAt: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      const creditBalance = Number(owner.creditBalance)
      const CREDIT_MIN_THRESHOLD = -10
      const isBlocked =
        owner.subscriptionStatus === "PAUSED" ||
        owner.subscriptionStatus === "PAYMENT_FAILED" ||
        creditBalance < CREDIT_MIN_THRESHOLD

      res.json({
        success: true,
        data: {
          subscriptionStatus: owner.subscriptionStatus,
          creditBalance,
          planType: owner.planType,
          isBlocked,
          blockReason: isBlocked
            ? owner.subscriptionStatus === "PAUSED"
              ? "PAUSED"
              : owner.subscriptionStatus === "PAYMENT_FAILED"
                ? "PAYMENT_FAILED"
                : creditBalance < CREDIT_MIN_THRESHOLD
                  ? "CREDIT_EXHAUSTED"
                  : null
            : null,
          pausedAt: owner.pausedAt,
          pauseRequestedAt: owner.pauseRequestedAt,
          pendingPlanType: owner.pendingPlanType,
          pendingPlanEffectiveDate: owner.pendingPlanEffectiveDate,
          lastPaymentFailedAt: owner.lastPaymentFailedAt,
          paymentFailureCount: owner.paymentFailureCount,
          nextBillingDate: owner.nextBillingDate,
          trialEndsAt: owner.trialEndsAt,
          planStartedAt: owner.planStartedAt,
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error getting owner subscription status:", error)
      res.status(500).json({
        error: "Errore recupero stato abbonamento",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /subscription-billing/transactions
   * Get transaction history for owner
   */
  getOwnerTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
      const type = req.query.type as TransactionType | undefined

      const skip = (page - 1) * limit

      const where: any = { userId }
      if (type) {
        where.type = type
      }

      const [transactions, total] = await Promise.all([
        this.prisma.billingTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            description: true,
            metadata: true,
            createdAt: true,
            workspaceId: true,
          },
        }),
        this.prisma.billingTransaction.count({ where }),
      ])

      res.json({
        success: true,
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error getting owner transactions:", error)
      res.status(500).json({
        error: "Errore recupero storico transazioni",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * POST /subscription-billing/recharge
   * Recharge credit for owner
   */
  rechargeOwnerCredit = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      const { amount } = req.body

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      if (!amount || typeof amount !== "number" || amount < 10 || amount > 1000) {
        res.status(400).json({
          error: "Importo non valido (min €10, max €1000)",
          code: "INVALID_AMOUNT",
        })
        return
      }

      const result = await this.billingService.rechargeOwnerCredit(userId, amount)

      logger.info(`[BILLING] 💰 Owner ${userId} recharged €${amount}`)

      res.json({
        success: true,
        message: `Credito ricaricato di €${amount}`,
        data: result,
      })
    } catch (error) {
      logger.error("[BILLING] Error recharging owner credit:", error)
      res.status(500).json({
        error: "Errore durante la ricarica",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * POST /subscription-billing/pause
   * Pause subscription for owner (effective next month)
   */
  pauseOwnerSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          subscriptionStatus: true,
          planType: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      if (owner.subscriptionStatus === "PAUSED") {
        res.status(400).json({
          error: "Abbonamento già in pausa",
          code: "ALREADY_PAUSED",
        })
        return
      }

      // IMMEDIATE pause - chatbots stop responding NOW
      const now = new Date()

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: "PAUSED",
          pauseRequestedAt: now,
          pausedAt: now,
        },
      })

      logger.info(
        `[BILLING] ⏸️ Subscription PAUSED IMMEDIATELY for owner ${owner.firstName} (userId: ${userId})`
      )

      res.json({
        success: true,
        message: "Abbonamento in pausa. I chatbot di tutti i workspace hanno smesso di rispondere.",
        data: {
          effectiveDate: now.toISOString(),
          currentStatus: "PAUSED",
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error pausing owner subscription:", error)
      res.status(500).json({
        error: "Errore durante la pausa dell'abbonamento",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * POST /subscription-billing/resume
   * Resume a paused subscription for owner
   */
  resumeOwnerSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          subscriptionStatus: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      if (owner.subscriptionStatus !== "PAUSED") {
        res.status(400).json({
          error: "L'abbonamento non è in pausa",
          code: "NOT_PAUSED",
        })
        return
      }

      // Resume from PAUSED
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: "ACTIVE",
          pausedAt: null,
          pauseRequestedAt: null,
        },
      })

      logger.info(`[BILLING] ▶️ Owner ${owner.firstName} resumed subscription`)

      res.json({
        success: true,
        message: "Abbonamento riattivato! I chatbot riprenderanno a rispondere.",
        data: { currentStatus: "ACTIVE" },
      })
    } catch (error) {
      logger.error("[BILLING] Error resuming owner subscription:", error)
      res.status(500).json({
        error: "Errore durante la riattivazione dell'abbonamento",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * POST /subscription-billing/upgrade
   * Upgrade plan for owner (immediate)
   */
  upgradeOwnerPlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      const { planType } = req.body

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const validPlans = ["BASIC", "PREMIUM", "ENTERPRISE"]
      if (!planType || !validPlans.includes(planType)) {
        res.status(400).json({
          error: "Piano non valido",
          code: "INVALID_PLAN",
        })
        return
      }

      const result = await this.billingService.upgradeOwnerPlan(userId, planType)

      logger.info(`[BILLING] ⬆️ Owner ${userId} upgraded to ${planType}`)

      res.json({
        success: true,
        message: `Piano aggiornato a ${planType}`,
        data: result,
      })
    } catch (error) {
      logger.error("[BILLING] Error upgrading owner plan:", error)
      res.status(500).json({
        error: "Errore durante l'upgrade del piano",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * POST /subscription-billing/downgrade
   * Schedule downgrade for owner (effective next billing cycle)
   */
  scheduleOwnerDowngrade = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      const { newPlan } = req.body

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const validPlans = ["BASIC", "PREMIUM"]
      if (!newPlan || !validPlans.includes(newPlan)) {
        res.status(400).json({
          error: "Piano non valido per downgrade",
          code: "INVALID_PLAN",
        })
        return
      }

      const result = await this.billingService.scheduleOwnerDowngrade(userId, newPlan)

      logger.info(`[BILLING] ⬇️ Owner ${userId} scheduled downgrade to ${newPlan}`)

      res.json({
        success: true,
        message: `Downgrade a ${newPlan} programmato per il prossimo ciclo di fatturazione`,
        data: result,
      })
    } catch (error) {
      logger.error("[BILLING] Error scheduling owner downgrade:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      
      // Check for specific errors
      if (errorMessage.includes("Cannot downgrade") || errorMessage.includes("usage exceeds")) {
        res.status(400).json({
          error: errorMessage,
          code: "DOWNGRADE_NOT_ALLOWED",
        })
        return
      }

      res.status(500).json({
        error: "Errore durante la programmazione del downgrade",
        message: errorMessage,
      })
    }
  }

  /**
   * DELETE /subscription-billing/pending-change
   * Cancel pending plan change for owner
   */
  cancelOwnerPendingChange = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          pendingPlanType: true,
          pendingPlanEffectiveDate: true,
        },
      })

      if (!owner) {
        res.status(404).json({ error: "User not found" })
        return
      }

      if (!owner.pendingPlanType) {
        res.status(400).json({
          error: "Nessun cambio piano in sospeso",
          code: "NO_PENDING_CHANGE",
        })
        return
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pendingPlanType: null,
          pendingPlanEffectiveDate: null,
        },
      })

      logger.info(`[BILLING] ❌ Owner ${userId} cancelled pending plan change`)

      res.json({
        success: true,
        message: "Cambio piano annullato",
      })
    } catch (error) {
      logger.error("[BILLING] Error cancelling owner pending change:", error)
      res.status(500).json({
        error: "Errore durante l'annullamento del cambio piano",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /subscription-billing/invoices
   * Get invoice history for owner
   */
  getOwnerInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 12

      // Lazy import to avoid circular dependencies
      const { invoiceService } = await import("../../../application/services/invoice.service")
      const result = await invoiceService.getInvoicesForOwner(userId, page, limit)

      res.json({
        success: true,
        data: result.invoices,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      })
    } catch (error) {
      logger.error("[BILLING] Error getting owner invoices:", error)
      res.status(500).json({
        error: "Errore nel recupero delle fatture",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /subscription-billing/invoices/current
   * Get current month's draft invoice with consumption breakdown
   */
  getCurrentInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      // Lazy import to avoid circular dependencies
      const { invoiceService } = await import("../../../application/services/invoice.service")
      const invoice = await invoiceService.getOrCreateCurrentInvoice(userId)

      res.json({
        success: true,
        data: invoice,
      })
    } catch (error) {
      logger.error("[BILLING] Error getting current invoice:", error)
      res.status(500).json({
        error: "Errore nel recupero della fattura corrente",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /subscription-billing/invoices/:invoiceId
   * Get specific invoice by ID
   */
  getInvoiceById = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      const { invoiceId } = req.params

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      // Lazy import to avoid circular dependencies
      const { invoiceService } = await import("../../../application/services/invoice.service")
      const invoice = await invoiceService.getInvoiceById(invoiceId, userId)

      if (!invoice) {
        res.status(404).json({
          error: "Fattura non trovata",
          code: "INVOICE_NOT_FOUND",
        })
        return
      }

      res.json({
        success: true,
        data: invoice,
      })
    } catch (error) {
      logger.error("[BILLING] Error getting invoice by ID:", error)
      res.status(500).json({
        error: "Errore nel recupero della fattura",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /subscription-billing/invoices/:invoiceId/pdf
   * Download invoice PDF for authenticated owner
   */
  downloadInvoicePdf = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      const { invoiceId } = req.params

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const invoice = await this.prisma.monthlyInvoice.findFirst({
        where: { id: invoiceId, userId },
        select: { id: true },
      })

      if (!invoice) {
        res.status(404).json({ error: "Fattura non trovata" })
        return
      }

      const { invoiceService } = await import("../../../application/services/invoice.service")
      const pdfBuffer = await invoiceService.generateInvoicePdf(invoiceId)

      res.setHeader("Content-Type", "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=invoice-${invoiceId}.pdf`
      )
      res.status(200).send(pdfBuffer)
    } catch (error) {
      logger.error("[BILLING] Error downloading invoice PDF:", error)
      res.status(500).json({
        error: "Errore download fattura",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * GET /subscription-billing/invoices/:invoiceId/credit-notes/:noteId/pdf
   * Download credit note PDF for authenticated owner
   */
  downloadCreditNotePdf = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id
      const { invoiceId, noteId } = req.params

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" })
        return
      }

      const note = await this.prisma.invoiceCreditNote.findFirst({
        where: {
          id: noteId,
          invoiceId,
          invoice: {
            userId,
          },
        },
        select: { id: true },
      })

      if (!note) {
        res.status(404).json({ error: "Credit note not found" })
        return
      }

      const { invoiceService } = await import("../../../application/services/invoice.service")
      const pdfBuffer = await invoiceService.generateCreditNotePdf(noteId)

      res.setHeader("Content-Type", "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=credit-note-${noteId}.pdf`
      )
      res.status(200).send(pdfBuffer)
    } catch (error) {
      logger.error("[BILLING] Error downloading credit note PDF:", error)
      res.status(500).json({
        error: "Errore download nota di credito",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
