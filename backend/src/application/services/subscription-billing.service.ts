/**
 * Subscription Billing Service
 * Feature 185: Subscription & Billing System
 *
 * Business logic for:
 * - Credit management (check, deduct, recharge)
 * - Plan management (upgrade, limits)
 * - Trial validation
 * - Usage tracking
 *
 * SECURITY: All methods validate workspaceId
 * CRITICAL: Credit deductions are atomic with transaction records
 */

import { PlanType, PrismaClient, TransactionType } from "@prisma/client"
import {
  BillingInfo,
  PlanLimits,
  SubscriptionBillingRepository,
  TransactionRecord,
} from "../../repositories/subscription-billing.repository"
import logger from "../../utils/logger"

export interface CreditCheckResult {
  hasSufficientCredit: boolean
  currentBalance: number
  requiredAmount: number
  deficit?: number
}

export interface PlanLimitCheckResult {
  withinLimits: boolean
  current: number
  max: number
  limitType: "products" | "customers" | "channels"
}

export interface BillingOverview {
  billing: BillingInfo
  limits: PlanLimits
  usage: {
    productsCount: number
    customersCount: number
    channelsCount: number
    productsPercentage: number
    customersPercentage: number
    channelsPercentage: number
  }
  planConfig: {
    displayName: string
    monthlyFee: number
    features: string[]
  }
}

export class SubscriptionBillingService {
  private repository: SubscriptionBillingRepository

  constructor(private prisma: PrismaClient) {
    this.repository = new SubscriptionBillingRepository(prisma)
  }

  // ============================================================================
  // BILLING INFO & OVERVIEW
  // ============================================================================

  /**
   * Get complete billing overview for workspace
   * Used by frontend to display billing section in profile
   */
  async getBillingOverview(workspaceId: string): Promise<BillingOverview> {
    const [billing, usage] = await Promise.all([
      this.repository.getWorkspaceBilling(workspaceId),
      this.repository.getWorkspaceUsage(workspaceId),
    ])

    if (!billing) {
      throw new Error("Workspace not found")
    }

    const limits = await this.repository.getPlanConfiguration(billing.planType)
    if (!limits) {
      throw new Error(`Plan configuration not found for ${billing.planType}`)
    }

    // Get plan display info
    const planConfig = await this.prisma.planConfiguration.findUnique({
      where: { planType: billing.planType },
      select: { displayName: true, monthlyFee: true, features: true },
    })

    return {
      billing,
      limits,
      usage: {
        ...usage,
        productsPercentage: Math.round(
          (usage.productsCount / limits.maxProducts) * 100
        ),
        customersPercentage: Math.round(
          (usage.customersCount / limits.maxCustomers) * 100
        ),
        channelsPercentage: Math.round(
          (usage.channelsCount / limits.maxChannels) * 100
        ),
      },
      planConfig: {
        displayName: planConfig?.displayName || billing.planType,
        monthlyFee: Number(planConfig?.monthlyFee || 0),
        features: planConfig?.features
          ? JSON.parse(planConfig.features as string)
          : [],
      },
    }
  }

  /**
   * Get credit balance (quick check for header display)
   */
  async getCreditBalance(workspaceId: string): Promise<number> {
    return this.repository.getCreditBalance(workspaceId)
  }

  /**
   * Get all available plans for upgrade comparison
   */
  async getAvailablePlans() {
    const plans = await this.repository.getAllPlanConfigurations()
    return plans.map((plan) => ({
      planType: plan.planType,
      displayName: plan.displayName,
      monthlyFee: Number(plan.monthlyFee),
      maxChannels: plan.maxChannels,
      maxProducts: plan.maxProducts,
      maxCustomers: plan.maxCustomers,
      messageCost: Number(plan.messageCost),
      orderCost: Number(plan.orderCost),
      pushCost: Number(plan.pushCost),
      features: plan.features ? JSON.parse(plan.features as string) : [],
    }))
  }

  // ============================================================================
  // CREDIT CHECKS & VALIDATION
  // ============================================================================

  /**
   * Check if workspace has sufficient credit for an operation
   * Does NOT deduct - just checks
   */
  async checkCredit(
    workspaceId: string,
    requiredAmount: number
  ): Promise<CreditCheckResult> {
    const currentBalance = await this.repository.getCreditBalance(workspaceId)

    return {
      hasSufficientCredit: currentBalance >= requiredAmount,
      currentBalance,
      requiredAmount,
      deficit:
        currentBalance < requiredAmount
          ? requiredAmount - currentBalance
          : undefined,
    }
  }

  /**
   * Check if trial is valid (not expired)
   */
  async isTrialValid(workspaceId: string): Promise<{
    isValid: boolean
    isTrialPlan: boolean
    daysRemaining: number | null
    expiredAt: Date | null
  }> {
    const billing = await this.repository.getWorkspaceBilling(workspaceId)

    if (!billing) {
      return {
        isValid: false,
        isTrialPlan: false,
        daysRemaining: null,
        expiredAt: null,
      }
    }

    // Non-trial plans are always valid
    if (billing.planType !== "FREE_TRIAL") {
      return {
        isValid: true,
        isTrialPlan: false,
        daysRemaining: null,
        expiredAt: null,
      }
    }

    return {
      isValid: !billing.isTrialExpired,
      isTrialPlan: true,
      daysRemaining: billing.daysUntilTrialExpires,
      expiredAt: billing.trialEndsAt,
    }
  }

  /**
   * Check if workspace is within plan limits
   */
  async checkPlanLimits(
    workspaceId: string,
    limitType: "products" | "customers" | "channels"
  ): Promise<PlanLimitCheckResult> {
    const billing = await this.repository.getWorkspaceBilling(workspaceId)
    if (!billing) {
      throw new Error("Workspace not found")
    }

    const limits = await this.repository.getPlanConfiguration(billing.planType)
    if (!limits) {
      throw new Error(`Plan configuration not found for ${billing.planType}`)
    }

    const usage = await this.repository.getWorkspaceUsage(workspaceId)

    let current: number
    let max: number

    switch (limitType) {
      case "products":
        current = usage.productsCount
        max = limits.maxProducts
        break
      case "customers":
        current = usage.customersCount
        max = limits.maxCustomers
        break
      case "channels":
        current = usage.channelsCount
        max = limits.maxChannels
        break
    }

    return {
      withinLimits: current < max,
      current,
      max,
      limitType,
    }
  }

  // ============================================================================
  // CREDIT OPERATIONS (DEDUCT & RECHARGE)
  // ============================================================================

  /**
   * Deduct credit for a message
   * Called after WhatsApp message is sent
   */
  async deductMessageCredit(
    workspaceId: string,
    messageId?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const billing = await this.repository.getWorkspaceBilling(workspaceId)
    if (!billing) {
      return { success: false, newBalance: 0, error: "Workspace not found" }
    }

    const limits = await this.repository.getPlanConfiguration(billing.planType)
    if (!limits) {
      return {
        success: false,
        newBalance: 0,
        error: "Plan configuration not found",
      }
    }

    const result = await this.repository.deductCredit(
      workspaceId,
      limits.messageCost,
      TransactionType.MESSAGE,
      "Messaggio WhatsApp",
      messageId,
      "message"
    )

    // Check for low balance notification
    if (result.success) {
      await this.checkAndNotifyLowBalance(workspaceId, result.newBalance, limits.lowBalanceThreshold)
    }

    return result
  }

  /**
   * Deduct credit for a push notification
   */
  async deductPushCredit(
    workspaceId: string,
    campaignId?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const billing = await this.repository.getWorkspaceBilling(workspaceId)
    if (!billing) {
      return { success: false, newBalance: 0, error: "Workspace not found" }
    }

    const limits = await this.repository.getPlanConfiguration(billing.planType)
    if (!limits) {
      return {
        success: false,
        newBalance: 0,
        error: "Plan configuration not found",
      }
    }

    const result = await this.repository.deductCredit(
      workspaceId,
      limits.pushCost,
      TransactionType.PUSH_NOTIFICATION,
      "Push notification",
      campaignId,
      "campaign"
    )

    if (result.success) {
      await this.checkAndNotifyLowBalance(workspaceId, result.newBalance, limits.lowBalanceThreshold)
    }

    return result
  }

  /**
   * Recharge credit (manual top-up)
   * OWNER-ONLY operation
   * 
   * If workspace is on FREE_TRIAL, automatically upgrades to BASIC
   */
  async rechargeCredit(
    workspaceId: string,
    amount: number
  ): Promise<{ success: boolean; newBalance: number; upgradedToPlan?: string }> {
    if (amount <= 0) {
      throw new Error("Amount must be positive")
    }

    // Validate reasonable amount (max €1000 per recharge)
    if (amount > 1000) {
      throw new Error("Maximum recharge amount is €1000")
    }

    // Check if workspace is on FREE_TRIAL - auto-upgrade to BASIC
    const billing = await this.repository.getWorkspaceBilling(workspaceId)
    let upgradedToPlan: string | undefined

    if (billing?.planType === "FREE_TRIAL") {
      // Auto-upgrade to BASIC when user recharges
      await this.repository.upgradePlan(workspaceId, "BASIC")
      upgradedToPlan = "BASIC"
      
      logger.info(
        `[BILLING] 🎉 Workspace ${workspaceId} auto-upgraded from FREE_TRIAL to BASIC on first recharge`
      )
    }

    const result = await this.repository.addCredit(
      workspaceId,
      amount,
      TransactionType.RECHARGE,
      `Ricarica credito: €${amount.toFixed(2)}`
    )

    return {
      ...result,
      upgradedToPlan,
    }
  }

  // ============================================================================
  // PLAN UPGRADE
  // ============================================================================

  /**
   * Upgrade workspace plan
   * OWNER-ONLY operation
   * Fee will be charged at next billing date (30 days)
   */
  async upgradePlan(
    workspaceId: string,
    newPlanType: PlanType
  ): Promise<{
    success: boolean
    nextBillingDate: Date
    newPlan: { displayName: string; monthlyFee: number }
  }> {
    // Validate plan type
    if (newPlanType === "FREE_TRIAL") {
      throw new Error("Cannot upgrade to Free Trial")
    }

    const billing = await this.repository.getWorkspaceBilling(workspaceId)
    if (!billing) {
      throw new Error("Workspace not found")
    }

    // Validate upgrade path
    const planOrder: Record<PlanType, number> = {
      FREE_TRIAL: 0,
      BASIC: 1,
      PREMIUM: 2,
      ENTERPRISE: 3,
    }

    if (planOrder[newPlanType] <= planOrder[billing.planType]) {
      throw new Error(
        `Cannot downgrade or stay on same plan. Current: ${billing.planType}, Requested: ${newPlanType}`
      )
    }

    // Get new plan config
    const newPlanConfig = await this.prisma.planConfiguration.findUnique({
      where: { planType: newPlanType },
      select: { displayName: true, monthlyFee: true },
    })

    if (!newPlanConfig) {
      throw new Error(`Plan configuration not found for ${newPlanType}`)
    }

    const result = await this.repository.upgradePlan(workspaceId, newPlanType)

    // Log the upgrade transaction (no charge now, charge at billing date)
    await this.prisma.billingTransaction.create({
      data: {
        workspaceId,
        type: TransactionType.UPGRADE_FEE,
        amount: 0, // Will be charged at next billing date
        balanceAfter: billing.creditBalance,
        description: `Upgrade a ${newPlanConfig.displayName} - Prima fatturazione: ${result.nextBillingDate.toLocaleDateString("it-IT")}`,
      },
    })

    logger.info(
      `[BILLING] 📈 Workspace ${workspaceId} upgraded from ${billing.planType} to ${newPlanType}`
    )

    return {
      success: true,
      nextBillingDate: result.nextBillingDate,
      newPlan: {
        displayName: newPlanConfig.displayName,
        monthlyFee: Number(newPlanConfig.monthlyFee),
      },
    }
  }

  // ============================================================================
  // TRANSACTION HISTORY
  // ============================================================================

  /**
   * Get transaction history with pagination
   */
  async getTransactionHistory(
    workspaceId: string,
    options: {
      page?: number
      limit?: number
      type?: TransactionType
      startDate?: Date
      endDate?: Date
    } = {}
  ): Promise<{
    transactions: TransactionRecord[]
    total: number
    page: number
    totalPages: number
  }> {
    const { page = 1, limit = 20, type, startDate, endDate } = options
    const offset = (page - 1) * limit

    const result = await this.repository.getTransactionHistory(workspaceId, {
      limit,
      offset,
      type,
      startDate,
      endDate,
    })

    return {
      transactions: result.transactions,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
    }
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Check and send low balance notification if needed
   */
  private async checkAndNotifyLowBalance(
    workspaceId: string,
    currentBalance: number,
    threshold: number
  ): Promise<void> {
    if (currentBalance <= threshold) {
      const shouldNotify =
        await this.repository.shouldSendLowBalanceNotification(workspaceId)

      if (shouldNotify) {
        // Update notification timestamp
        await this.repository.updateLowBalanceNotification(workspaceId)

        // TODO: Send email notification
        logger.warn(
          `[BILLING] ⚠️ Low balance alert: €${currentBalance.toFixed(2)} (threshold: €${threshold.toFixed(2)}, workspace: ${workspaceId})`
        )

        // For now, just log - email integration can be added later
        // await emailService.sendLowBalanceAlert(workspaceId, currentBalance)
      }
    }
  }

  /**
   * Get cost for a specific operation type
   */
  async getOperationCost(
    workspaceId: string,
    operation: "message" | "order" | "push"
  ): Promise<number> {
    const billing = await this.repository.getWorkspaceBilling(workspaceId)
    if (!billing) {
      throw new Error("Workspace not found")
    }

    const limits = await this.repository.getPlanConfiguration(billing.planType)
    if (!limits) {
      throw new Error("Plan configuration not found")
    }

    switch (operation) {
      case "message":
        return limits.messageCost
      case "order":
        return limits.orderCost
      case "push":
        return limits.pushCost
    }
  }
}
