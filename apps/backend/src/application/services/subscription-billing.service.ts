/**
 * Subscription Billing Service
 * Feature 185: Subscription & Billing System
 * Feature 198: Owner-based billing (credit shared across all workspaces)
 *
 * Business logic for:
 * - Credit management (check, deduct, recharge)
 * - Plan management (upgrade, limits)
 * - Trial validation
 * - Usage tracking
 *
 * CRITICAL (Feature 198): Billing is per OWNER (User), NOT per Workspace
 * - creditBalance, planType, subscriptionStatus are on User model
 * - workspaceId is optional in operations (for tracking which channel)
 * 
 * Methods with "workspaceId" parameter are for backward compatibility.
 * New code should use methods with "userId" parameter when possible.
 */

import { PlanType, PrismaClient, TransactionType, SubscriptionStatus } from "@echatbot/database"
import {
  BillingInfo,
  PlanLimits,
  SubscriptionBillingRepository,
  TransactionRecord,
} from "../../repositories/subscription-billing.repository"
import logger from "../../utils/logger"
import { CREDIT_MIN_THRESHOLD } from "./workspace-access.service"
import { platformConfigService } from "../../services/platform-config.service"
import { EmailService } from "./email.service"

const emailService = new EmailService()

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
  limitType: "customers" | "channels" | "teamMembers" | "products"
}

export interface BillingOverview {
  billing: BillingInfo
  limits: PlanLimits
  thresholds: {
    creditMinThreshold: number
    lowBalanceThreshold: number
  }
  usage: {
    productsCount: number
    customersCount: number
    channelsCount: number
    teamMembersCount: number
    customersPercentage: number
    channelsPercentage: number
    teamMembersPercentage: number
  }
  planConfig: {
    displayName: string
    monthlyFee: number
    features: string[]
  }
}

export class SubscriptionBillingService {
  private repository: SubscriptionBillingRepository
  private readonly PAYMENT_FAILURE_BLOCK_THRESHOLD = 3

  constructor(private prisma: PrismaClient) {
    this.repository = new SubscriptionBillingRepository(prisma)
  }

  // ============================================================================
  // OWNER-BASED BILLING INFO (Feature 198)
  // ============================================================================

  /**
   * Get complete billing overview for owner (user)
   * Feature 198: Primary method - billing is per owner
   */
  async getOwnerBillingOverview(userId: string): Promise<BillingOverview> {
    const [billing, usage] = await Promise.all([
      this.repository.getOwnerBilling(userId),
      this.repository.getOwnerUsage(userId),
    ])

    if (!billing) {
      throw new Error("User not found")
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
      thresholds: {
        creditMinThreshold: CREDIT_MIN_THRESHOLD,
        lowBalanceThreshold: limits.lowBalanceThreshold,
      },
      usage: {
        ...usage,
        customersPercentage:
          limits.maxCustomers > 0
            ? Math.round((usage.customersCount / limits.maxCustomers) * 100)
            : 0,
        channelsPercentage:
          limits.maxChannels > 0
            ? Math.round((usage.channelsCount / limits.maxChannels) * 100)
            : 0,
        teamMembersPercentage:
          limits.maxTeamMembers > 0 && limits.maxTeamMembers < 999
            ? Math.round((usage.teamMembersCount / limits.maxTeamMembers) * 100)
            : 0,
      },
      planConfig: {
        displayName: planConfig?.displayName || billing.planType,
        monthlyFee: Number(planConfig?.monthlyFee || 0),
        features:
          typeof planConfig?.features === "string"
            ? JSON.parse(planConfig.features)
            : planConfig?.features ?? [],
      },
    }
  }

  /**
   * Get billing overview from workspaceId (backward compatibility)
   * @deprecated Use getOwnerBillingOverview(userId) directly when possible
   */
  async getBillingOverview(workspaceId: string): Promise<BillingOverview> {
    // Get workspace owner
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      throw new Error("Workspace not found or has no owner")
    }

    return this.getOwnerBillingOverview(workspace.ownerId)
  }

  /**
   * Get owner credit balance
   * Feature 198: Primary method
   */
  async getOwnerCreditBalance(userId: string): Promise<number> {
    return this.repository.getOwnerCreditBalance(userId)
  }

  /**
   * Get credit balance from workspaceId (backward compatibility)
   * @deprecated Use getOwnerCreditBalance(userId) directly when possible
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
      maxTeamMembers: plan.maxTeamMembers,
      messageCost: Number(plan.messageCost),
      orderCost: Number(plan.orderCost),
      pushCost: Number(plan.pushCost),
      features:
        typeof plan.features === "string"
          ? JSON.parse(plan.features)
          : plan.features ?? [],
    }))
  }

  // ============================================================================
  // OWNER-BASED CREDIT CHECKS (Feature 198)
  // ============================================================================

  /**
   * Check if owner has sufficient credit for an operation
   * Feature 198: Primary method
   */
  async checkOwnerCredit(
    userId: string,
    requiredAmount: number
  ): Promise<CreditCheckResult> {
    const CREDIT_MIN_THRESHOLD = -10

    const currentBalance = await this.repository.getOwnerCreditBalance(userId)
    const balanceAfterDeduction = currentBalance - requiredAmount

    return {
      hasSufficientCredit: balanceAfterDeduction >= CREDIT_MIN_THRESHOLD,
      currentBalance,
      requiredAmount,
      deficit:
        balanceAfterDeduction < CREDIT_MIN_THRESHOLD
          ? Math.abs(balanceAfterDeduction - CREDIT_MIN_THRESHOLD)
          : undefined,
    }
  }

  /**
   * Check credit from workspaceId (backward compatibility)
   * @deprecated Use checkOwnerCredit(userId) directly when possible
   */
  async checkCredit(
    workspaceId: string,
    requiredAmount: number
  ): Promise<CreditCheckResult> {
    const CREDIT_MIN_THRESHOLD = -10

    const currentBalance = await this.repository.getCreditBalance(workspaceId)
    const balanceAfterDeduction = currentBalance - requiredAmount

    return {
      hasSufficientCredit: balanceAfterDeduction >= CREDIT_MIN_THRESHOLD,
      currentBalance,
      requiredAmount,
      deficit:
        balanceAfterDeduction < CREDIT_MIN_THRESHOLD
          ? Math.abs(balanceAfterDeduction - CREDIT_MIN_THRESHOLD)
          : undefined,
    }
  }

  /**
   * Check if owner's trial is valid (not expired)
   * Feature 198: Primary method
   */
  async isOwnerTrialValid(userId: string): Promise<{
    isValid: boolean
    isTrialPlan: boolean
    daysRemaining: number | null
    expiredAt: Date | null
  }> {
    const billing = await this.repository.getOwnerBilling(userId)

    if (!billing) {
      return {
        isValid: false,
        isTrialPlan: false,
        daysRemaining: null,
        expiredAt: null,
      }
    }

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
   * Check trial validity from workspaceId (backward compatibility)
   * @deprecated Use isOwnerTrialValid(userId) directly when possible
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
   * Check if owner is within plan limits
   * Feature 198: Primary method - limits are aggregated across all owner's workspaces
   */
  async checkOwnerPlanLimits(
    userId: string,
    limitType: "customers" | "channels" | "teamMembers" | "products"
  ): Promise<PlanLimitCheckResult> {
    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      throw new Error("User not found")
    }

    const limits = await this.repository.getPlanConfiguration(billing.planType)
    if (!limits) {
      throw new Error(`Plan configuration not found for ${billing.planType}`)
    }

    const usage = await this.repository.getOwnerUsage(userId)

    let current: number
    let max: number | null

    switch (limitType) {
      case "customers":
        current = usage.customersCount
        max = limits.maxCustomers
        break
      case "channels":
        current = usage.channelsCount
        max = limits.maxChannels
        break
      case "products":
        current = usage.productsCount
        max = limits.maxProducts
        break
      case "teamMembers":
        current = usage.teamMembersCount
        max = limits.maxTeamMembers ?? 999
        break
    }

    return {
      withinLimits: current < max,
      current,
      max,
      limitType,
    }
  }

  /**
   * Check plan limits from workspaceId (backward compatibility)
   * @deprecated Use checkOwnerPlanLimits(userId) directly when possible
   */
  async checkPlanLimits(
    workspaceId: string,
    limitType: "customers" | "channels" | "teamMembers" | "products"
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
    let max: number | null

    switch (limitType) {
      case "customers":
        current = usage.customersCount
        max = limits.maxCustomers
        break
      case "channels":
        current = usage.channelsCount
        max = limits.maxChannels
        break
      case "products":
        current = usage.productsCount
        max = limits.maxProducts
        break
      case "teamMembers":
        current = usage.teamMembersCount
        max = limits.maxTeamMembers ?? 999  // null = unlimited, treat as 999
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
  // OWNER-BASED CREDIT OPERATIONS (Feature 198)
  // ============================================================================

  /**
   * Deduct credit for a message from owner
   * Feature 198: Primary method - credit is deducted from owner, channel is tracked
   *
   * @param userId - Owner's user ID
   * @param workspaceId - Optional: which channel sent the message
   * @param messageId - Optional: reference to the message
   */
  async deductOwnerMessageCredit(
    userId: string,
    workspaceId?: string,
    messageId?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      return { success: false, newBalance: 0, error: "User not found" }
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
      userId,
      limits.messageCost,
      TransactionType.MESSAGE,
      "WhatsApp Message",
      workspaceId,
      messageId,
      "message"
    )

    if (result.success) {
      await this.checkAndNotifyOwnerLowBalance(userId, result.newBalance, limits.lowBalanceThreshold)
    }

    return result
  }

  /**
   * Deduct credit for a widget message from owner
   * Uses platform config key WIDGET_MESSAGE (not plan messageCost).
   */
  async deductOwnerWidgetMessageCredit(
    userId: string,
    workspaceId?: string,
    messageId?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      return { success: false, newBalance: 0, error: "User not found" }
    }

    const limits = await this.repository.getPlanConfiguration(billing.planType)
    if (!limits) {
      return {
        success: false,
        newBalance: 0,
        error: "Plan configuration not found",
      }
    }

    const widgetCost = await platformConfigService.getPrice("WIDGET_MESSAGE")

    const result = await this.repository.deductCredit(
      userId,
      widgetCost,
      TransactionType.MESSAGE,
      "Widget message",
      workspaceId,
      messageId,
      "widget_message"
    )

    if (result.success) {
      await this.checkAndNotifyOwnerLowBalance(
        userId,
        result.newBalance,
        limits.lowBalanceThreshold
      )
    }

    return result
  }

  /**
   * Deduct message credit from workspaceId (backward compatibility)
   * @deprecated Use deductOwnerMessageCredit(userId) directly when possible
   */
  async deductMessageCredit(
    workspaceId: string,
    messageId?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    // Get workspace owner
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      return { success: false, newBalance: 0, error: "Workspace not found" }
    }

    return this.deductOwnerMessageCredit(workspace.ownerId, workspaceId, messageId)
  }

  /**
   * Deduct credit for a push notification from owner
   * Feature 198: Primary method
   */
  async deductOwnerPushCredit(
    userId: string,
    workspaceId?: string,
    campaignId?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      return { success: false, newBalance: 0, error: "User not found" }
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
      userId,
      limits.pushCost,
      TransactionType.PUSH_NOTIFICATION,
      "Push notification",
      workspaceId,
      campaignId,
      "campaign"
    )

    if (result.success) {
      await this.checkAndNotifyOwnerLowBalance(userId, result.newBalance, limits.lowBalanceThreshold)
    }

    return result
  }

  /**
   * Deduct push credit from workspaceId (backward compatibility)
   * @deprecated Use deductOwnerPushCredit(userId) directly when possible
   */
  async deductPushCredit(
    workspaceId: string,
    campaignId?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      return { success: false, newBalance: 0, error: "Workspace not found" }
    }

    return this.deductOwnerPushCredit(workspace.ownerId, workspaceId, campaignId)
  }

  /**
   * Recharge credit for owner (manual top-up)
   * Feature 198: Primary method - OWNER-ONLY operation
   * 
   * If owner is on FREE_TRIAL, automatically upgrades to BASIC
   */
  async rechargeOwnerCredit(
    userId: string,
    amount: number
  ): Promise<{ success: boolean; newBalance: number; upgradedToPlan?: string }> {
    if (amount < 10) {
      throw new Error("Minimum recharge amount is $10")
    }

    if (amount > 1000) {
      throw new Error("Maximum recharge amount is $1000")
    }

    const billing = await this.repository.getOwnerBilling(userId)
    let upgradedToPlan: string | undefined

    if (billing?.planType === "FREE_TRIAL") {
      await this.repository.upgradeOwnerPlan(userId, "BASIC")
      upgradedToPlan = "BASIC"
      
      logger.info(
        `[BILLING] 🎉 User ${userId} auto-upgraded from FREE_TRIAL to BASIC on first recharge`
      )
    }

    // Create RECHARGE transaction
    const result = await this.repository.addCredit(
      userId,
      amount,
      TransactionType.RECHARGE,
      `Credit recharge: $${amount.toFixed(2)}`
    )

    // If upgraded, create UPGRADE_FEE transaction to document the plan change
    if (upgradedToPlan === "BASIC") {
      const basicPlanConfig = await this.repository.getPlanConfiguration("BASIC")
      const monthlyFeeStr = basicPlanConfig ? `$${basicPlanConfig.monthlyFee.toFixed(2)}/month` : ""
      await this.repository.addCredit(
        userId,
        0,
        TransactionType.UPGRADE_FEE,
        `Upgrade from Free Trial to ${upgradedToPlan} plan${monthlyFeeStr ? ` (${monthlyFeeStr})` : ""}`
      )
    }

    return {
      ...result,
      upgradedToPlan,
    }
  }

  /**
   * Recharge credit from workspaceId (backward compatibility)
   * @deprecated Use rechargeOwnerCredit(userId) directly when possible
   */
  async rechargeCredit(
    workspaceId: string,
    amount: number
  ): Promise<{ success: boolean; newBalance: number; upgradedToPlan?: string }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      throw new Error("Workspace not found")
    }

    return this.rechargeOwnerCredit(workspace.ownerId, amount)
  }

  // ============================================================================
  // OWNER-BASED PLAN MANAGEMENT (Feature 198)
  // ============================================================================

  /**
   * Upgrade owner plan
   * Feature 198: Primary method - OWNER-ONLY operation
   */
  async upgradeOwnerPlan(
    userId: string,
    newPlanType: PlanType
  ): Promise<{
    success: boolean
    nextBillingDate: Date
    newPlan: { displayName: string; monthlyFee: number }
  }> {
    if (newPlanType === "FREE_TRIAL") {
      throw new Error("Cannot upgrade to Free Trial")
    }

    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      throw new Error("User not found")
    }

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

    const newPlanConfig = await this.prisma.planConfiguration.findUnique({
      where: { planType: newPlanType },
      select: { displayName: true, monthlyFee: true },
    })

    if (!newPlanConfig) {
      throw new Error(`Plan configuration not found for ${newPlanType}`)
    }

    const result = await this.repository.upgradeOwnerPlan(userId, newPlanType)

    // Log the upgrade transaction
    const monthlyFeeStr = newPlanConfig.monthlyFee ? `€${Number(newPlanConfig.monthlyFee).toFixed(2)}/month` : ""
    await this.prisma.billingTransaction.create({
      data: {
        userId,
        type: TransactionType.UPGRADE_FEE,
        amount: 0,
        balanceAfter: billing.creditBalance,
        description: `Upgrade to ${newPlanConfig.displayName}${monthlyFeeStr ? ` (${monthlyFeeStr})` : ""}`,
      },
    })

    logger.info(
      `[BILLING] 📈 User ${userId} upgraded from ${billing.planType} to ${newPlanType}`
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

  /**
   * Upgrade plan from workspaceId (backward compatibility)
   * @deprecated Use upgradeOwnerPlan(userId) directly when possible
   */
  async upgradePlan(
    workspaceId: string,
    newPlanType: PlanType
  ): Promise<{
    success: boolean
    nextBillingDate: Date
    newPlan: { displayName: string; monthlyFee: number }
  }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      throw new Error("Workspace not found")
    }

    return this.upgradeOwnerPlan(workspace.ownerId, newPlanType)
  }

  /**
   * Change owner plan (upgrade or downgrade)
   * Feature 198: Primary method - OWNER-ONLY operation
   */
  async changeOwnerPlan(
    userId: string,
    newPlanType: PlanType
  ): Promise<{
    success: boolean
    nextBillingDate: Date
    newPlan: { displayName: string; monthlyFee: number }
    isDowngrade: boolean
  }> {
    if (newPlanType === "FREE_TRIAL") {
      throw new Error("Cannot change to Free Trial")
    }

    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      throw new Error("User not found")
    }

    const planOrder: Record<PlanType, number> = {
      FREE_TRIAL: 0,
      BASIC: 1,
      PREMIUM: 2,
      ENTERPRISE: 3,
    }

    if (planOrder[newPlanType] === planOrder[billing.planType]) {
      throw new Error(`Already on ${billing.planType} plan`)
    }

    const isDowngrade = planOrder[newPlanType] < planOrder[billing.planType]

    if (isDowngrade) {
      const usage = await this.repository.getOwnerUsage(userId)
      const targetPlanConfig = await this.prisma.planConfiguration.findUnique({
        where: { planType: newPlanType },
        select: { maxChannels: true, maxProducts: true, maxCustomers: true, maxTeamMembers: true },
      })

      if (!targetPlanConfig) {
        throw new Error(`Plan configuration not found for ${newPlanType}`)
      }

      const violations: string[] = []

      if (usage.customersCount > targetPlanConfig.maxCustomers) {
        violations.push(`Too many customers: ${usage.customersCount}/${targetPlanConfig.maxCustomers}`)
      }
      if (usage.channelsCount > targetPlanConfig.maxChannels) {
        violations.push(`Too many channels: ${usage.channelsCount}/${targetPlanConfig.maxChannels}`)
      }
      if (usage.productsCount > targetPlanConfig.maxProducts) {
        violations.push(`Too many products: ${usage.productsCount}/${targetPlanConfig.maxProducts}`)
      }
      if (targetPlanConfig.maxTeamMembers !== null && usage.teamMembersCount > targetPlanConfig.maxTeamMembers) {
        violations.push(`Too many team members: ${usage.teamMembersCount}/${targetPlanConfig.maxTeamMembers}`)
      }

      if (violations.length > 0) {
        throw new Error(
          `Cannot downgrade to ${newPlanType}: ${violations.join(", ")}. Please reduce usage first.`
        )
      }
    }

    const newPlanConfig = await this.prisma.planConfiguration.findUnique({
      where: { planType: newPlanType },
      select: { displayName: true, monthlyFee: true },
    })

    if (!newPlanConfig) {
      throw new Error(`Plan configuration not found for ${newPlanType}`)
    }

    const result = await this.repository.upgradeOwnerPlan(userId, newPlanType)

    // Delete previous plan change transactions
    await this.prisma.billingTransaction.deleteMany({
      where: {
        userId,
        type: TransactionType.UPGRADE_FEE,
      },
    })

    const action = isDowngrade ? "Downgrade" : "Upgrade"
    const monthlyFeeStr = newPlanConfig.monthlyFee ? `€${Number(newPlanConfig.monthlyFee).toFixed(2)}/month` : ""
    await this.prisma.billingTransaction.create({
      data: {
        userId,
        type: TransactionType.UPGRADE_FEE,
        amount: 0,
        balanceAfter: billing.creditBalance,
        description: `${action} to ${newPlanConfig.displayName}${monthlyFeeStr ? ` (${monthlyFeeStr})` : ""}`,
      },
    })

    const logEmoji = isDowngrade ? "📉" : "📈"
    logger.info(
      `[BILLING] ${logEmoji} User ${userId} ${action.toLowerCase()}d from ${billing.planType} to ${newPlanType}`
    )

    return {
      success: true,
      nextBillingDate: result.nextBillingDate,
      newPlan: {
        displayName: newPlanConfig.displayName,
        monthlyFee: Number(newPlanConfig.monthlyFee),
      },
      isDowngrade,
    }
  }

  /**
   * Schedule a plan downgrade for the next billing cycle
   * Feature 198: Primary method for owner-based billing
   */
  async scheduleOwnerDowngrade(
    userId: string,
    newPlanType: PlanType
  ): Promise<{
    success: boolean
    effectiveDate: Date
    currentPlan: PlanType
    pendingPlan: PlanType
  }> {
    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      throw new Error("User not found")
    }

    const planOrder: Record<PlanType, number> = {
      FREE_TRIAL: 0,
      BASIC: 1,
      PREMIUM: 2,
      ENTERPRISE: 3,
    }

    // Verify it's actually a downgrade
    if (planOrder[newPlanType] >= planOrder[billing.planType]) {
      throw new Error(`${newPlanType} is not a downgrade from ${billing.planType}`)
    }

    // Validate usage limits for target plan
    const usage = await this.repository.getOwnerUsage(userId)
    const targetPlanConfig = await this.prisma.planConfiguration.findUnique({
      where: { planType: newPlanType },
      select: { maxChannels: true, maxProducts: true, maxCustomers: true, maxTeamMembers: true },
    })

    if (!targetPlanConfig) {
      throw new Error(`Plan configuration not found for ${newPlanType}`)
    }

    const violations: string[] = []

    if (usage.customersCount > targetPlanConfig.maxCustomers) {
      violations.push(`Clienti: ${usage.customersCount}/${targetPlanConfig.maxCustomers}`)
    }
    if (usage.channelsCount > targetPlanConfig.maxChannels) {
      violations.push(`Canali: ${usage.channelsCount}/${targetPlanConfig.maxChannels}`)
    }
    if (usage.productsCount > targetPlanConfig.maxProducts) {
      violations.push(`Prodotti: ${usage.productsCount}/${targetPlanConfig.maxProducts}`)
    }
    if (targetPlanConfig.maxTeamMembers !== null && usage.teamMembersCount > targetPlanConfig.maxTeamMembers) {
      violations.push(`Membri del team: ${usage.teamMembersCount}/${targetPlanConfig.maxTeamMembers}`)
    }

    if (violations.length > 0) {
      throw new Error(
        `Non puoi passare a ${newPlanType}: superi i limiti del piano (${violations.join(", ")}). Riduci prima l'utilizzo.`
      )
    }

    // Calculate effective date (1st of next month)
    const now = new Date()
    const effectiveDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    effectiveDate.setHours(0, 0, 0, 0)

    // Schedule the downgrade
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingPlanType: newPlanType,
        pendingPlanEffectiveDate: effectiveDate,
      },
    })

    logger.info(
      `[BILLING] ⬇️ User ${userId} scheduled downgrade from ${billing.planType} to ${newPlanType}, effective: ${effectiveDate.toISOString()}`
    )

    return {
      success: true,
      effectiveDate,
      currentPlan: billing.planType,
      pendingPlan: newPlanType,
    }
  }

  /**
   * Change plan from workspaceId (backward compatibility)
   * @deprecated Use changeOwnerPlan(userId) directly when possible
   */
  async changePlan(
    workspaceId: string,
    newPlanType: PlanType
  ): Promise<{
    success: boolean
    nextBillingDate: Date
    newPlan: { displayName: string; monthlyFee: number }
    isDowngrade: boolean
  }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })

    if (!workspace?.ownerId) {
      throw new Error("Workspace not found")
    }

    return this.changeOwnerPlan(workspace.ownerId, newPlanType)
  }

  // ============================================================================
  // OWNER-BASED TRANSACTION HISTORY (Feature 198)
  // ============================================================================

  /**
   * Get owner transaction history with pagination
   * Feature 198: Primary method
   */
  async getOwnerTransactionHistory(
    userId: string,
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

    const result = await this.repository.getOwnerTransactionHistory(userId, {
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

  /**
   * Get transaction history from workspaceId (backward compatibility)
   * @deprecated Use getOwnerTransactionHistory(userId) directly when possible
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
  // SUBSCRIPTION STATUS (Feature 197 + 198)
  // ============================================================================

  /**
   * Pause subscription for owner - IMMEDIATE effect
   * Feature 198: Primary method - affects ALL owner's workspaces
   * 
   * Business logic:
   * - Pausa IMMEDIATA: chatbot smette di rispondere subito
   * - A fine mese si paga solo il consumo effettivo fino alla pausa
   * - Niente abbonamento per mesi in pausa
   */
  async requestOwnerPause(userId: string): Promise<{
    success: boolean
    effectiveDate: Date
  }> {
    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      throw new Error("User not found")
    }

    if (billing.subscriptionStatus === "PAUSED") {
      throw new Error("Subscription is already paused")
    }

    // IMMEDIATE pause - no more PAUSE_PENDING
    const now = new Date()

    await this.repository.updateOwnerSubscriptionStatus(userId, {
      subscriptionStatus: "PAUSED",
      pausedAt: now,
      pauseRequestedAt: now,
    })

    logger.info(
      `[BILLING] ⏸️ User ${userId} paused subscription IMMEDIATELY at ${now.toISOString()}`
    )

    return {
      success: true,
      effectiveDate: now, // Immediate effect
    }
  }

  /**
   * Resume owner subscription - FREE, no charges
   * Feature 198: Primary method - resumes ALL owner's workspaces
   * 
   * Business logic:
   * - Riattivazione IMMEDIATA e GRATUITA
   * - Riprende a consumare credito normalmente
   * - Pagamento abbonamento dal 1° del mese successivo
   */
  async resumeOwnerSubscription(userId: string): Promise<{
    success: boolean
    nextBillingDate: Date
  }> {
    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      throw new Error("User not found")
    }

    if (billing.subscriptionStatus === "ACTIVE") {
      throw new Error("Subscription is already active")
    }

    // Calculate next billing date (1st of next month)
    const now = new Date()
    const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    nextBillingDate.setHours(0, 0, 0, 0)

    await this.repository.updateOwnerSubscriptionStatus(userId, {
      subscriptionStatus: "ACTIVE",
      pausedAt: null,
      pauseRequestedAt: null,
    })

    logger.info(`[BILLING] ▶️ User ${userId} resumed subscription - FREE, next billing: ${nextBillingDate.toISOString()}`)

    return { 
      success: true,
      nextBillingDate,
    }
  }

  /**
   * Get owner subscription status
   * Feature 198: Primary method
   */
  async getOwnerSubscriptionStatus(userId: string): Promise<{
    status: SubscriptionStatus
    pausedAt: Date | null
    pauseRequestedAt: Date | null
    pauseEffectiveDate: Date | null
  }> {
    const status = await this.repository.getOwnerSubscriptionStatus(userId)
    if (!status) {
      throw new Error("User not found")
    }

    // No more PAUSE_PENDING - pause is immediate
    // Keep this for backward compatibility
    let pauseEffectiveDate: Date | null = null
    if (status.status === "PAUSED" && status.pausedAt) {
      pauseEffectiveDate = status.pausedAt
    }

    return {
      status: status.status,
      pausedAt: status.pausedAt,
      pauseRequestedAt: status.pauseRequestedAt,
      pauseEffectiveDate,
    }
  }

  /**
   * Record a payment failure for an owner.
   * After N failures, subscriptionStatus becomes PAYMENT_FAILED.
   */
  async recordOwnerPaymentFailure(userId: string): Promise<{
    paymentFailureCount: number
    subscriptionStatus: SubscriptionStatus
    lastPaymentFailedAt: Date
    blocked: boolean
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { paymentFailureCount: true, subscriptionStatus: true },
    })

    if (!user) {
      throw new Error("User not found")
    }

    const now = new Date()
    const nextCount = (user.paymentFailureCount ?? 0) + 1
    const shouldBlock = nextCount >= this.PAYMENT_FAILURE_BLOCK_THRESHOLD
    const nextStatus = shouldBlock ? "PAYMENT_FAILED" : user.subscriptionStatus

    await this.repository.updateOwnerSubscriptionStatus(userId, {
      paymentFailureCount: nextCount,
      lastPaymentFailedAt: now,
      subscriptionStatus: nextStatus,
    })

    return {
      paymentFailureCount: nextCount,
      subscriptionStatus: nextStatus,
      lastPaymentFailedAt: now,
      blocked: shouldBlock,
    }
  }

  /**
   * Reset payment failure state for an owner.
   */
  async resetOwnerPaymentFailures(userId: string): Promise<{
    paymentFailureCount: number
    subscriptionStatus: SubscriptionStatus
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    })

    if (!user) {
      throw new Error("User not found")
    }

    const nextStatus =
      user.subscriptionStatus === "PAYMENT_FAILED" ? "ACTIVE" : user.subscriptionStatus

    await this.repository.updateOwnerSubscriptionStatus(userId, {
      paymentFailureCount: 0,
      lastPaymentFailedAt: null,
      subscriptionStatus: nextStatus,
    })

    return {
      paymentFailureCount: 0,
      subscriptionStatus: nextStatus,
    }
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Check and send low balance notification for owner if needed
   */
  private async checkAndNotifyOwnerLowBalance(
    userId: string,
    currentBalance: number,
    threshold: number
  ): Promise<void> {
    if (currentBalance <= threshold) {
      const shouldNotify =
        await this.repository.shouldSendOwnerLowBalanceNotification(userId)

      if (shouldNotify) {
        await this.repository.updateOwnerLowBalanceNotification(userId)

        logger.warn(
          `[BILLING] ⚠️ Low balance alert: €${currentBalance.toFixed(2)} (threshold: €${threshold.toFixed(2)}, user: ${userId})`
        )

        // Send email notification — fire-and-forget (don't block credit deduction)
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true },
        })
        if (user?.email) {
          emailService.sendLowBalanceAlert({
            to: user.email,
            firstName: user.firstName || 'there',
            currentBalance,
            threshold,
          }).catch((err) => logger.error('[BILLING] Failed to send low balance alert:', err))
        }
      }
    }
  }

  /**
   * @deprecated Use checkAndNotifyOwnerLowBalance
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
        await this.repository.updateLowBalanceNotification(workspaceId)

        logger.warn(
          `[BILLING] ⚠️ Low balance alert: €${currentBalance.toFixed(2)} (threshold: €${threshold.toFixed(2)}, workspace: ${workspaceId})`
        )
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

  /**
   * Get owner's cost for a specific operation type
   * Feature 198: Primary method
   */
  async getOwnerOperationCost(
    userId: string,
    operation: "message" | "order" | "push"
  ): Promise<number> {
    const billing = await this.repository.getOwnerBilling(userId)
    if (!billing) {
      throw new Error("User not found")
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
