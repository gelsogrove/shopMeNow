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
 * 2. owner.subscriptionStatus === 'PAYMENT_FAILED' → Payment failed, service blocked
 * 3. owner.creditBalance < -10 → Credit exhausted below threshold
 * 4. workspace.channelStatus === false → WIP mode (handled separately with WIP message)
 *
 * CRITICAL (Feature 198): Billing fields are on User (Owner), NOT Workspace
 * - subscriptionStatus, creditBalance → checked from workspace.owner (User)
 * - channelStatus → still on Workspace (per-channel setting)
 */

import { PrismaClient, SubscriptionStatus } from "@echatbot/database"
import logger from "../../utils/logger"

/** Credit minimum threshold - allow negative up to -€10 */
export const CREDIT_MIN_THRESHOLD = -10

export type BlockReason =
  | "PAUSED"
  | "PAYMENT_FAILED"
  | "CREDIT_EXHAUSTED"
  | "CHANNEL_DISABLED"
  | "WORKSPACE_INACTIVE"
  | "NO_OWNER"
  | "OWNER_NOT_FOUND"
  // | "CANCELLED" // TODO: Add when CANCELLED status is added to schema

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
   * 4. Owner payment failed → block ALL owner's workspaces
   * 5. Owner credit exhausted (< -€10) → block ALL owner's workspaces
   * 6. Channel disabled → WIP mode (separate handling)
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
          isActive: true,
          deletedAt: true,
          channelStatus: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              subscriptionStatus: true,
              creditBalance: true,
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
      if (!workspace.isActive || workspace.deletedAt) {
        logger.info(`[ACCESS] 🚫 Workspace inactive: ${workspace.name}`)
        return {
          canProcess: false,
          blockReason: "WORKSPACE_INACTIVE",
          message: "Workspace is not active",
          details: {
            channelStatus: workspace.channelStatus,
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
          details: {
            channelStatus: workspace.channelStatus,
          },
        }
      }

      const owner = workspace.owner
      const creditBalance = Number(owner.creditBalance)

      // 3. Check owner subscription status - PAUSED
      if (owner.subscriptionStatus === "PAUSED") {
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
            channelStatus: workspace.channelStatus,
            ownerId: workspace.ownerId,
          },
        }
      }

      // NOTE: CANCELLED status not in current schema. When added, uncomment:
      // if (owner.subscriptionStatus === "CANCELLED") {
      //   return { canProcess: false, blockReason: "CANCELLED", ... }
      // }

      // 4. Check owner subscription status - PAYMENT_FAILED
      if (owner.subscriptionStatus === "PAYMENT_FAILED") {
        logger.info(
          `[ACCESS] 💳 Owner payment failed for workspace: ${workspace.name} (owner: ${workspace.ownerId})`
        )
        return {
          canProcess: false,
          blockReason: "PAYMENT_FAILED",
          message:
            "Payment failed. Please update your payment method to continue.",
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            channelStatus: workspace.channelStatus,
            ownerId: workspace.ownerId,
          },
        }
      }

      // 5. Check owner credit balance (allow negative up to -€10)
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
            channelStatus: workspace.channelStatus,
            ownerId: workspace.ownerId,
          },
        }
      }

      // 6. Check channel status (WIP mode) - optional, still per-workspace
      if (!skipChannelCheck && workspace.channelStatus === false) {
        logger.info(
          `[ACCESS] 🚧 Channel disabled (WIP mode) for workspace: ${workspace.name}`
        )
        return {
          canProcess: false,
          blockReason: "CHANNEL_DISABLED",
          message: "Channel is in maintenance mode",
          details: {
            subscriptionStatus: owner.subscriptionStatus,
            creditBalance,
            channelStatus: workspace.channelStatus,
            ownerId: workspace.ownerId,
          },
        }
      }

      // All checks passed
      return {
        canProcess: true,
        details: {
          subscriptionStatus: owner.subscriptionStatus,
          creditBalance,
          channelStatus: workspace.channelStatus,
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
    return result.blockReason === "CHANNEL_DISABLED"
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
      result.blockReason === "PAYMENT_FAILED" ||
      result.blockReason === "CREDIT_EXHAUSTED"
      // || result.blockReason === "CANCELLED" // TODO: Add when schema supports it
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
    status: "active" | "paused" | "payment_failed" | "credit_exhausted" | "wip" | "no_owner"
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

    let status: "active" | "paused" | "payment_failed" | "credit_exhausted" | "wip" | "no_owner" = "active"

    if (accessResult.blockReason === "NO_OWNER") {
      status = "no_owner"
    } else if (accessResult.blockReason === "PAUSED") {
      status = "paused"
    } else if (accessResult.blockReason === "PAYMENT_FAILED") {
      status = "payment_failed"
    } else if (accessResult.blockReason === "CREDIT_EXHAUSTED") {
      status = "credit_exhausted"
    } else if (accessResult.blockReason === "CHANNEL_DISABLED") {
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

      if (owner.subscriptionStatus === "PAYMENT_FAILED") {
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
    status: "active" | "paused" | "payment_failed" | "credit_exhausted"
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

    let status: "active" | "paused" | "payment_failed" | "credit_exhausted" = "active"

    if (accessResult.blockReason === "PAUSED") {
      status = "paused"
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
