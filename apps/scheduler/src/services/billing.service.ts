import { prisma, Prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Billing Service for Scheduler
 * Feature 198: Billing Owner Refactor
 *
 * CRITICAL CHANGE (Feature 198):
 * - Credit is now deducted from OWNER (User), not Workspace
 * - workspaceId is kept in transaction for channel tracking
 * - userId is REQUIRED in all BillingTransaction records
 *
 * SECURITY: All operations are atomic (using Prisma transactions)
 * SECURITY: Always validates workspaceId and finds owner
 */
export class BillingService {

  /**
   * Deduct credit for a sent message
   * 
   * Feature 198: Now deducts from Owner's creditBalance (shared across all workspaces)
   *
   * @param workspaceId - The workspace where message was sent (for tracking)
   * @param messageId - Optional message ID for transaction reference
   * @returns Result with success status and new balance
   */
  async deductMessageCredit(
    workspaceId: string,
    messageId?: string,
    messageType: 'MESSAGE' | 'PUSH' = 'MESSAGE'
  ): Promise<{
    success: boolean
    newBalance?: number
    amountDeducted?: number
    error?: string
  }> {
    try {
      // Get workspace with owner (Feature 198: we need ownerId for billing)
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId, deletedAt: null }, // CRITICAL: Exclude soft-deleted workspaces
        select: {
          id: true,
          name: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              creditBalance: true, // Feature 198: Credit is on User now
              planType: true,
              subscriptionStatus: true,
            },
          },
        },
      })

      if (!workspace) {
        return { success: false, error: 'Workspace not found or deleted' }
      }

      if (!workspace.owner) {
        return { success: false, error: 'Workspace owner not found' }
      }

      const owner = workspace.owner

      // Check if owner's subscription is active
      if (owner.subscriptionStatus !== 'ACTIVE') {
        logger.warn(`[Billing] ⚠️ Owner ${owner.firstName} subscription not active: ${owner.subscriptionStatus}`)
        return { success: false, error: `Subscription not active: ${owner.subscriptionStatus}` }
      }

      // Get message cost from owner's plan configuration (Feature 198: use owner's plan)
      const planConfig = await prisma.planConfiguration.findUnique({
        where: { planType: owner.planType },
        select: { messageCost: true, pushCost: true },
      })

      if (!planConfig) {
        return { success: false, error: 'Plan configuration not found' }
      }

      const messageCost =
        messageType === 'PUSH'
          ? Number(planConfig.pushCost)
          : Number(planConfig.messageCost)
      const currentBalance = Number(owner.creditBalance)

      // Check if sufficient balance on Owner
      if (currentBalance < messageCost) {
        logger.warn(
          `[Billing] ⚠️ Insufficient credit for owner ${owner.firstName}: $${currentBalance.toFixed(2)} < $${messageCost.toFixed(2)} (${messageType})`
        )
        return {
          success: false,
          error: `Insufficient credit. Balance: $${currentBalance.toFixed(2)}, Required: $${messageCost.toFixed(2)}`
        }
      }

      const newBalance = currentBalance - messageCost
      const ownerName = `${owner.firstName} ${owner.lastName || ''}`.trim()

      // Atomic transaction: update Owner balance + create transaction record
      await prisma.$transaction(async (tx) => {
        // Feature 198: Update OWNER balance (shared across all workspaces)
        await tx.user.update({
          where: { id: owner.id },
          data: { creditBalance: new Prisma.Decimal(newBalance.toFixed(2)) },
        })

        // Feature 198: Create transaction record with userId (required) + workspaceId (tracking)
        await tx.billingTransaction.create({
          data: {
            userId: owner.id,          // Required: Owner who paid
            workspaceId: workspaceId,  // Optional: Which workspace used the credit (for tracking)
            type: messageType === 'PUSH' ? 'PUSH_NOTIFICATION' : 'MESSAGE',
            amount: new Prisma.Decimal((-messageCost).toFixed(2)), // Negative for deductions
            balanceAfter: new Prisma.Decimal(newBalance.toFixed(2)),
            description:
              messageType === 'PUSH'
                ? `Push Campaign - ${workspace.name}`
                : `WhatsApp Message - ${workspace.name}`,
            referenceId: messageId,
            referenceType: 'message',
          },
        })
      })

      logger.info(
        `[Billing] 💰 Deducted $${messageCost.toFixed(2)} (${messageType}) from owner "${ownerName}" (workspace: ${workspace.name}): $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)}`
      )

      return {
        success: true,
        newBalance,
        amountDeducted: messageCost,
      }

    } catch (error) {
      logger.error('[Billing] ❌ Error deducting credit:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * Check if owner has sufficient credit for a message
   * 
   * Feature 198: Checks owner's balance, not workspace's
   *
   * @param workspaceId - The workspace to check
   * @returns true if owner has enough credit
   */
  async hasOwnerCredit(
    workspaceId: string,
    messageType: 'MESSAGE' | 'PUSH' = 'MESSAGE'
  ): Promise<boolean> {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId, deletedAt: null },
        select: {
          owner: {
            select: {
              creditBalance: true,
              planType: true,
              subscriptionStatus: true,
            },
          },
        },
      })

      if (!workspace?.owner) {
        return false
      }

      // Check subscription status
      if (workspace.owner.subscriptionStatus !== 'ACTIVE') {
        return false
      }

      // Get message cost
      const planConfig = await prisma.planConfiguration.findUnique({
        where: { planType: workspace.owner.planType },
        select: { messageCost: true, pushCost: true },
      })

      if (!planConfig) {
        return false
      }

      const messageCost =
        messageType === 'PUSH'
          ? Number(planConfig.pushCost)
          : Number(planConfig.messageCost)
      const currentBalance = Number(workspace.owner.creditBalance)

      return currentBalance >= messageCost
    } catch (error) {
      logger.error('[Billing] ❌ Error checking credit:', error)
      return false
    }
  }

  /**
   * Get owner's current credit balance for a workspace
   * 
   * Feature 198: Returns owner's balance
   *
   * @param workspaceId - The workspace
   * @returns Owner's credit balance
   */
  async getOwnerBalance(workspaceId: string): Promise<number | null> {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId, deletedAt: null },
        select: {
          owner: {
            select: {
              creditBalance: true,
            },
          },
        },
      })

      return workspace?.owner ? Number(workspace.owner.creditBalance) : null
    } catch (error) {
      logger.error('[Billing] ❌ Error getting balance:', error)
      return null
    }
  }

  /**
   * Deduct credit for a push campaign message
   * Feature 198: Deducts from Owner's creditBalance (shared across all workspaces)
   *
   * @param userId - Owner's user ID
   * @param workspaceId - Optional: which channel sent the push
   * @param campaignId - Optional: reference to the campaign
   * @returns Result with success status and new balance
   */
  async deductOwnerPushCredit(
    userId: string,
    workspaceId?: string,
    campaignId?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    try {
      // Get owner's plan configuration for push cost
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          creditBalance: true,
          planType: true,
        },
      })

      if (!owner) {
        return { success: false, newBalance: 0, error: 'User not found' }
      }

      // Get plan configuration for push cost
      const planConfig = await prisma.planConfiguration.findUnique({
        where: { planType: owner.planType },
        select: { pushCost: true },
      })

      if (!planConfig) {
        return { success: false, newBalance: 0, error: 'Plan configuration not found' }
      }

      const pushCost = Number(planConfig.pushCost)

      // Atomic transaction: deduct credit + create transaction record
      const result = await prisma.$transaction(async (tx) => {
        // 1. Deduct credit from owner
        const updatedOwner = await tx.user.update({
          where: { id: userId },
          data: {
            creditBalance: { decrement: pushCost },
          },
          select: { creditBalance: true },
        })

        const newBalance = Number(updatedOwner.creditBalance)

        // 2. Create billing transaction
        await tx.billingTransaction.create({
          data: {
            userId,
            workspaceId,
            type: 'PUSH_NOTIFICATION',
            amount: -pushCost,
            balanceAfter: newBalance,
            description: 'Push campaign message',
            referenceId: campaignId,
            referenceType: 'campaign',
          },
        })

        return { success: true, newBalance }
      })

      logger.info(
        `[Billing] 💳 Push credit deducted: -€${pushCost.toFixed(2)} (owner: ${userId}, balance: €${result.newBalance.toFixed(2)})`
      )

      return result
    } catch (error) {
      logger.error('[Billing] ❌ Error deducting push credit:', error)
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
