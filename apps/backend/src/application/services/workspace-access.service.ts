/**
 * Workspace Access Service
 * Feature 197: Billing Subscription Separation
 * Feature 198: Owner-based billing (billing checks on User, not Workspace)
 *
 * Centralized service for checking if a workspace can process messages.
 * Called BEFORE any chatbot processing (WhatsApp webhook, LLM router, push notifications).
 *
 * Blocking conditions (checked on OWNER, not workspace):
 * 1. owner.subscriptionStatus === 'PAUSED' → User paused subscription
 * 2. owner.creditBalance < -10 → Credit exhausted below threshold
 * 3. workspace.debugMode === true → Debug mode / Test mode (WIP message handled separately)
 *
 * CRITICAL (Feature 198): Billing fields are on User (Owner), NOT Workspace
 * - subscriptionStatus, creditBalance → checked from workspace.owner (User)
 * - channelStatus → still on Workspace (per-channel setting)
 */

import { PrismaClient, SubscriptionStatus } from "@echatbot/database"
import logger from "../../utils/logger"

/** Credit minimum threshold - allow negative up to -€10 */
export const CREDIT_MIN_THRESHOLD = -10

export const PAYMENT_FAILURE_BLOCK_THRESHOLD = 3

export type BlockReason =
  | "PAUSED"
  | "CANCELLED"
  | "PAYMENT_FAILED"
  | "CREDIT_EXHAUSTED"
  | "DEBUG_MODE"
  | "CHANNEL_DISABLED"
  | "WORKSPACE_INACTIVE"
  | "WORKSPACE_DELETED"
  | "NO_OWNER"
  | "OWNER_NOT_FOUND"
  | "OWNER_DELETED"

export interface AccessCheckResult {
  canProcess: boolean
  blockReason?: BlockReason
  message?: string
  details?: {
    subscriptionStatus?: SubscriptionStatus
    creditBalance?: number
    channelStatus?: boolean
    ownerId?: string
  }
}

export class WorkspaceAccessService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if workspace can process messages
   * Feature 198: Billing checks (subscriptionStatus, creditBalance) are on Owner (User)
   *
   * Priority order:
   * 1. Workspace inactive (soft deleted) → block
   * 2. No owner → block (shouldn't happen, but safety)
   * 3. Owner subscription paused → block ALL owner's workspaces
   * 4. Owner credit exhausted (< -€10) → block ALL owner's workspaces
   * 5. Debug mode → WIP mode (separate handling)
   * 6. Channel disabled → silent block (no response)
   *
   * @param workspaceId - Workspace to check
   * @param skipChannelCheck - Skip channel status check (for internal operations)
   * @returns AccessCheckResult with canProcess and blockReason
   */
  async canProcessMessages(
    workspaceId: string,
    skipChannelCheck = false
  ): Promise<AccessCheckResult> {
    try {
      // Feature 198: Get workspace WITH owner billing info
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          deletedAt: true,
          debugMode: true,
          channelStatus: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              deletedAt: true,
              subscriptionStatus: true,
              creditBalance: true,
              paymentFailureCount: true,
            },
          },
        },
      })

      if (!workspace) {
        logger.warn(`[ACCESS] Workspace not found: ${workspaceId}`)
        return {
          canProcess: false,
          blockReason: "WORKSPACE_INACTIVE",
          message: "Workspace not found",
        }
      }

      // 1. Check if workspace is active (not soft deleted)
      if (workspace.deletedAt !== null) {
        logger.info(`[ACCESS] 🚫 Workspace deleted: ${workspace.name}`)
        return {
          canProcess: false,
          blockReason: "WORKSPACE_DELETED",
          message: "Workspace has been deleted",
          details: {
            ownerId: workspace.ownerId || undefined,
          },
        }
      }

      // 2. Check if workspace has owner
      if (!workspace.owner || !workspace.ownerId) {
        logger.warn(`[ACCESS] ⚠️ Workspace has no owner: ${workspace.name}`)
        return {
          canProcess: false,
          blockReason: "NO_OWNER",
          message: "Workspace has no owner",
          details: {},
        }
      }

      const owner = workspace.owner
      const creditBalance = Number(owner.creditBalance)
      const subscriptionStatus = String(owner.subscriptionStatus || "").toUpperCase()
      const paymentFailureCount = Number(owner.paymentFailureCount ?? 0)
      const channelStatus = workspace.channelStatus ?? true

      // 2b. Check if owner is soft-deleted (deletedAt not null)
      if (owner.deletedAt) {
        logger.warn(`[ACCESS] 🚨 Owner soft-deleted for workspace: ${workspace.name} (owner: ${workspace.ownerId})`)
        return {
          canProcess: false,
          blockReason: "OWNER_DELETED",
          message: "Account owner has been deleted. Contact support.",
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            ownerId: workspace.ownerId,
          },
        }
      }

      // 3. Check owner subscription status - PAUSED
      if (subscriptionStatus === "PAUSED") {
        logger.info(
          `[ACCESS] ⏸️ Owner subscription paused for workspace: ${workspace.name} (owner: ${workspace.ownerId})`
        )
        return {
          canProcess: false,
          blockReason: "PAUSED",
          message: "Subscription is paused. Resume to continue using the service.",
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            ownerId: workspace.ownerId,
          },
        }
      }

      if (subscriptionStatus === "PAYMENT_FAILED" && paymentFailureCount >= PAYMENT_FAILURE_BLOCK_THRESHOLD) {
        logger.info(
          `[ACCESS] ❌ Owner payment failed (count=${paymentFailureCount}) for workspace: ${workspace.name} (owner: ${workspace.ownerId})`
        )
        return {
          canProcess: false,
          blockReason: "PAYMENT_FAILED",
          message: "Payment failed. Please update your payment method to continue.",
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            ownerId: workspace.ownerId,
          },
        }
      }

      // 3b. Check owner subscription status - CANCELLED
      if (subscriptionStatus === "CANCELLED") {
        logger.info(
          `[ACCESS] 🚫 Owner subscription cancelled for workspace: ${workspace.name} (owner: ${workspace.ownerId})`
        )
        return {
          canProcess: false,
          blockReason: "CANCELLED",
          message: "Subscription has been cancelled. Please resubscribe to continue using the service.",
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            ownerId: workspace.ownerId,
          },
        }
      }

      // 4. Check owner credit balance (allow negative up to -€10)
      if (creditBalance < CREDIT_MIN_THRESHOLD) {
        logger.info(
          `[ACCESS] 💰 Owner credit exhausted for workspace: ${workspace.name} (€${creditBalance.toFixed(2)} < €${CREDIT_MIN_THRESHOLD}, owner: ${workspace.ownerId})`
        )
        return {
          canProcess: false,
          blockReason: "CREDIT_EXHAUSTED",
          message: `Credit exhausted. Balance: €${creditBalance.toFixed(2)}. Please recharge.`,
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            ownerId: workspace.ownerId,
          },
        }
      }

      if (!skipChannelCheck && workspace.debugMode === true) {
        logger.info(
          `[ACCESS] 🛠️ Debug mode active for workspace: ${workspace.name} (debugMode=${workspace.debugMode})`
        )
        return {
          canProcess: false,
          blockReason: "DEBUG_MODE",
          message: "Debug mode active (WIP message).",
          details: {
            ownerId: workspace.ownerId || undefined,
          },
        }
      }

      if (!skipChannelCheck && channelStatus === false) {
        logger.info(
          `[ACCESS] 🚫 Channel disabled for workspace: ${workspace.name} (channelStatus=${channelStatus})`
        )
        return {
          canProcess: false,
          blockReason: "CHANNEL_DISABLED",
          message: "Channel is disabled.",
          details: {
            ownerId: workspace.ownerId || undefined,
          },
        }
      }

      // All checks passed
      return {
        canProcess: true,
        details: {
          subscriptionStatus: owner.subscriptionStatus,
          creditBalance,
          ownerId: workspace.ownerId,
        },
      }
    } catch (error) {
      logger.error("[ACCESS] Error checking workspace access:", error)
      // On error, allow processing (fail open) to not block legitimate traffic
      // The actual operation will fail if there's a real issue
      return {
        canProcess: true,
        message: "Access check failed, proceeding with caution",
      }
    }
  }

  /**
   * Check if workspace should show WIP message
   * Used specifically for channel disabled state
   *
   * @param workspaceId - Workspace to check
   * @returns true if should show WIP message
   */
  async shouldShowWIPMessage(workspaceId: string): Promise<boolean> {
    const result = await this.canProcessMessages(workspaceId)
    return result.blockReason === "DEBUG_MODE"
  }

  /**
   * Check if workspace is blocked due to billing issues
   * (PAUSED, CANCELLED, PAYMENT_FAILED, or CREDIT_EXHAUSTED)
   * Feature 198: These are checked on Owner (User), affecting ALL their workspaces
   *
   * @param workspaceId - Workspace to check
   * @returns true if blocked due to billing
   */
  async isBlockedDueToBilling(workspaceId: string): Promise<boolean> {
    const result = await this.canProcessMessages(workspaceId, true) // skip channel check
    return (
      result.blockReason === "PAUSED" ||
      result.blockReason === "CANCELLED" ||
      result.blockReason === "PAYMENT_FAILED" ||
      result.blockReason === "CREDIT_EXHAUSTED"
    )
  }

  /**
   * Get detailed workspace access status
   * For display in admin/dashboard
   * Feature 198: Returns owner's billing status
   *
   * @param workspaceId - Workspace to check
   * @returns Detailed access status
   */
  async getAccessStatus(workspaceId: string): Promise<{
    status: "active" | "paused" | "cancelled" | "payment_failed" | "credit_exhausted" | "wip" | "no_owner"
    canProcessMessages: boolean
    creditBalance: number
    subscriptionStatus: SubscriptionStatus | null
    channelStatus: boolean
    blockReason?: BlockReason
    ownerId?: string
  }> {
    // Feature 198: Get owner billing info
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        channelStatus: true,
        ownerId: true,
        owner: {
          select: {
            subscriptionStatus: true,
            creditBalance: true,
            paymentFailureCount: true,
          },
        },
      },
    })

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }

    const accessResult = await this.canProcessMessages(workspaceId)
    const creditBalance = workspace.owner ? Number(workspace.owner.creditBalance) : 0
    const subscriptionStatus = workspace.owner?.subscriptionStatus || null

    let status: "active" | "paused" | "cancelled" | "payment_failed" | "credit_exhausted" | "wip" | "no_owner" = "active"

    if (accessResult.blockReason === "NO_OWNER") {
      status = "no_owner"
    } else if (accessResult.blockReason === "PAUSED") {
      status = "paused"
    } else if (accessResult.blockReason === "CANCELLED") {
      status = "cancelled"
    } else if (accessResult.blockReason === "PAYMENT_FAILED") {
      status = "payment_failed"
    } else if (accessResult.blockReason === "CREDIT_EXHAUSTED") {
      status = "credit_exhausted"
    } else if (
      accessResult.blockReason === "DEBUG_MODE" ||
      accessResult.blockReason === "CHANNEL_DISABLED"
    ) {
      status = "wip"
    }

    return {
      status,
      canProcessMessages: accessResult.canProcess,
      creditBalance,
      subscriptionStatus,
      channelStatus: workspace.channelStatus,
      blockReason: accessResult.blockReason,
      ownerId: workspace.ownerId || undefined,
    }
  }

  /**
   * Check access by owner ID (for owner-level operations)
   * Feature 198: Direct owner check without going through workspace
   *
   * @param userId - Owner's user ID
   * @returns AccessCheckResult with canProcess and blockReason
   */
  async canOwnerProcess(userId: string): Promise<AccessCheckResult> {
    try {
      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
        creditBalance: true,
        paymentFailureCount: true,
      },
    })

      if (!owner) {
        return {
          canProcess: false,
          blockReason: "NO_OWNER",
          message: "User not found",
        }
      }

      const creditBalance = Number(owner.creditBalance)

      if (owner.subscriptionStatus === "PAUSED") {
        return {
          canProcess: false,
          blockReason: "PAUSED",
          message: "Subscription is paused. Resume to continue using the service.",
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            ownerId: owner.id,
          },
        }
      }

      if (owner.subscriptionStatus === "CANCELLED") {
        return {
          canProcess: false,
          blockReason: "CANCELLED",
          message: "Subscription has been cancelled. Please resubscribe to continue using the service.",
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            ownerId: owner.id,
          },
        }
      }

      const paymentFailureCount = owner.paymentFailureCount ?? 0

      if (
        owner.subscriptionStatus === "PAYMENT_FAILED" &&
        paymentFailureCount >= PAYMENT_FAILURE_BLOCK_THRESHOLD
      ) {
        return {
          canProcess: false,
          blockReason: "PAYMENT_FAILED",
          message: "Payment failed. Please update your payment method to continue.",
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            ownerId: owner.id,
          },
        }
      }

      if (creditBalance < CREDIT_MIN_THRESHOLD) {
        return {
          canProcess: false,
          blockReason: "CREDIT_EXHAUSTED",
          message: `Credit exhausted. Balance: €${creditBalance.toFixed(2)}. Please recharge.`,
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            ownerId: owner.id,
          },
        }
      }

      return {
        canProcess: true,
        details: {
          subscriptionStatus: owner.subscriptionStatus,
          creditBalance,
          ownerId: owner.id,
        },
      }
    } catch (error) {
      logger.error("[ACCESS] Error checking owner access:", error)
      return {
        canProcess: true,
        message: "Access check failed, proceeding with caution",
      }
    }
  }

  /**
   * Alias for canOwnerProcess - more descriptive name
   * Feature 198: Direct owner check for message processing
   *
   * @param userId - Owner's user ID
   * @returns AccessCheckResult with canProcess and blockReason
   */
  async canOwnerProcessMessages(userId: string): Promise<AccessCheckResult> {
    const result = await this.canOwnerProcess(userId)
    // Map NO_OWNER to OWNER_NOT_FOUND for clearer API
    if (result.blockReason === "NO_OWNER") {
      return {
        ...result,
        blockReason: "OWNER_NOT_FOUND" as BlockReason,
      }
    }
    return result
  }

  /**
   * Get owner access status for dashboard/admin display
   * Feature 198: Direct owner status without workspace context
   *
   * @param userId - Owner's user ID
   * @returns Detailed owner access status
   */
  async getOwnerAccessStatus(userId: string): Promise<{
    status: "active" | "paused" | "cancelled" | "payment_failed" | "credit_exhausted"
    canProcessMessages: boolean
    creditBalance: number
    subscriptionStatus: SubscriptionStatus | null
    blockReason?: BlockReason
  }> {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        creditBalance: true,
      },
    })

    if (!owner) {
      throw new Error(`Owner not found: ${userId}`)
    }

    const accessResult = await this.canOwnerProcess(userId)
    const creditBalance = Number(owner.creditBalance)

    let status: "active" | "paused" | "cancelled" | "payment_failed" | "credit_exhausted" = "active"

    if (accessResult.blockReason === "PAUSED") {
      status = "paused"
    } else if (accessResult.blockReason === "CANCELLED") {
      status = "cancelled"
    } else if (accessResult.blockReason === "PAYMENT_FAILED") {
      status = "payment_failed"
    } else if (accessResult.blockReason === "CREDIT_EXHAUSTED") {
      status = "credit_exhausted"
    }

    return {
      status,
      canProcessMessages: accessResult.canProcess,
      creditBalance,
      subscriptionStatus: owner.subscriptionStatus,
      blockReason: accessResult.blockReason,
    }
  }
}
