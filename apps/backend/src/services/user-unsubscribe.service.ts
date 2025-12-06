/**
 * UserUnsubscribeService - Handles user account deletion with role-aware cascade logic
 *
 * OWNER: Cascades to entire workspace (all customers, orders, messages, agents)
 * AGENT: Isolated delete (only that user)
 *
 * SAFETY: All operations in transaction with workspaceId chain verification
 * AUDIT: Every deletion logged to SoftDeleteAuditLog with affected IDs
 * EMAIL: Notification sent to user AND admin for compliance
 */

import { PrismaClient, UserRole } from "@echatbot/database"
import logger from "../utils/logger"
import { EmailService } from "../application/services/email.service"

interface UnsubscribeResult {
  success: boolean
  message: string
  cascadeType: "OWNER_CASCADE" | "AGENT_ISOLATED"
  affectedRecords: {
    workspaces?: number
    customers?: number
    orders?: number
    messages?: number
    chatSessions?: number
    agents?: number
  }
  deletedDate: Date
  permanentDeleteDate: Date
}

export class UserUnsubscribeService {
  private emailService: EmailService

  constructor(private prisma: PrismaClient) {
    this.emailService = new EmailService()
  }

  /**
   * Initiate user account deletion (soft-delete)
   * Detects role and performs appropriate cascade
   */
  async unsubscribeUser(userId: string, reason: string = "User requested deletion"): Promise<UnsubscribeResult> {
    // 1. Find user and verify it exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    if (user.deletedAt !== null) {
      throw new Error(`User already deleted: ${userId}`)
    }

    // 2. Determine role and cascade type
    const ownedWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId: userId },
    })

    const isOwner = ownedWorkspaces.length > 0

    if (isOwner) {
      return await this.deleteOwner(userId, reason, ownedWorkspaces[0].id)
    } else {
      return await this.deleteAgent(userId, reason)
    }
  }

  /**
   * Delete OWNER - Cascade to entire workspace and all customers
   */
  private async deleteOwner(userId: string, reason: string, workspaceId: string): Promise<UnsubscribeResult> {
    const deletedDate = new Date()
    const permanentDeleteDate = new Date(deletedDate)
    permanentDeleteDate.setDate(permanentDeleteDate.getDate() + 90)

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Verify chain: User -> Workspace
        const user = await tx.user.findUnique({ where: { id: userId } })
        const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } })

        if (!user || !workspace || workspace.ownerId !== userId) {
          throw new Error("Owner verification failed - security chain broken")
        }

        // 2. Count affected records BEFORE deletion
        const customerCount = await tx.customers.count({ where: { workspaceId, deletedAt: null } })
        const orderCount = await tx.orders.count({ where: { workspaceId, deletedAt: null } })
        const messageCount = await tx.message.count({ where: { deletedAt: null } })
        const agentCount = await tx.userWorkspace.count({ where: { workspaceId } })
        const sessionCount = await tx.chatSession.count({ where: { workspaceId, deletedAt: null } })

        // 3. Soft-delete in order of dependencies
        // First delete messages, chat sessions, orders, customers
        await tx.message.updateMany({
          where: { chatSession: { workspaceId } },
          data: { deletedAt: deletedDate }
        })

        await tx.chatSession.updateMany({
          where: { workspaceId },
          data: { deletedAt: deletedDate }
        })

        await tx.orderItems.updateMany({
          where: { order: { workspaceId } },
          data: { deletedAt: deletedDate }
        })

        await tx.orders.updateMany({
          where: { workspaceId },
          data: { deletedAt: deletedDate }
        })

        await tx.customers.updateMany({
          where: { workspaceId },
          data: { deletedAt: deletedDate }
        })

        // Then delete all agents in workspace
        const agents = await tx.userWorkspace.findMany({ where: { workspaceId } })
        for (const agent of agents) {
          await tx.user.update({
            where: { id: agent.userId },
            data: { deletedAt: deletedDate },
          })
        }

        // Finally delete workspace and user
        await tx.workspace.update({ where: { id: workspaceId }, data: { deletedAt: deletedDate } })
        await tx.user.update({ where: { id: userId }, data: { deletedAt: deletedDate } })

        // 4. Log to audit trail
        await tx.softDeleteAuditLog.create({
          data: {
            workspaceId,
            entityType: "OWNER_CASCADE",
            deletedIds: [userId, workspaceId],
            deletedIdCount: 1 + customerCount + orderCount + messageCount + agentCount + sessionCount,
            reason,
            deletedByUserId: userId, // Self-initiated
          },
        })

        return {
          success: true,
          message: `Owner account deleted with full workspace cascade`,
          cascadeType: "OWNER_CASCADE" as const,
          affectedRecords: {
            workspaces: 1,
            customers: customerCount,
            orders: orderCount,
            messages: messageCount,
            chatSessions: sessionCount,
            agents: agentCount,
          },
          deletedDate,
          permanentDeleteDate,
        }
      })

      logger.info(`Owner unsubscribed: userId=${userId}, workspaceId=${workspaceId}`, {
        cascadeType: "OWNER_CASCADE",
        affected: result.affectedRecords,
      })

      // 📧 Send notification email to user and admin
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } })
        const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } })
        if (user?.email) {
          await this.emailService.sendUnsubscribeNotification({
            userEmail: user.email,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            workspaceName: workspace?.name,
            cascadeType: "OWNER_CASCADE",
            permanentDeleteDate: result.permanentDeleteDate,
            adminEmail: workspace?.notificationEmail || undefined,
          })
        }
      } catch (emailError) {
        logger.error("Failed to send unsubscribe email notification:", emailError)
        // Don't fail the operation - email is non-critical
      }

      return result
    } catch (error) {
      logger.error(`Failed to unsubscribe owner: ${userId}`, error)
      throw error
    }
  }

  /**
   * Delete AGENT - Isolated delete (workspace unaffected)
   */
  private async deleteAgent(userId: string, reason: string): Promise<UnsubscribeResult> {
    const deletedDate = new Date()
    const permanentDeleteDate = new Date(deletedDate)
    permanentDeleteDate.setDate(permanentDeleteDate.getDate() + 90)

    try {
      await this.prisma.$transaction(async (tx) => {
        // Get user's workspace(s) for audit
        const workspaces = await tx.userWorkspace.findMany({ where: { userId } })

        // Soft-delete only this user
        await tx.user.update({
          where: { id: userId },
          data: { deletedAt: deletedDate },
        })

        // Log to audit trail (one entry per workspace)
        for (const ws of workspaces) {
          await tx.softDeleteAuditLog.create({
            data: {
              workspaceId: ws.workspaceId,
              entityType: "AGENT_ISOLATED",
              deletedIds: [userId],
              deletedIdCount: 1,
              reason,
              deletedByUserId: userId, // Self-initiated
            },
          })
        }
      })

      logger.info(`Agent unsubscribed: userId=${userId}`, {
        cascadeType: "AGENT_ISOLATED",
      })

      // 📧 Send notification email to user and admin
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } })
        if (user?.email) {
          await this.emailService.sendUnsubscribeNotification({
            userEmail: user.email,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            cascadeType: "AGENT_ISOLATED",
            permanentDeleteDate,
          })
        }
      } catch (emailError) {
        logger.error("Failed to send unsubscribe email notification:", emailError)
        // Don't fail the operation - email is non-critical
      }

      return {
        success: true,
        message: `Agent account deleted (isolated)`,
        cascadeType: "AGENT_ISOLATED" as const,
        affectedRecords: {
          agents: 1,
        },
        deletedDate,
        permanentDeleteDate,
      }
    } catch (error) {
      logger.error(`Failed to unsubscribe agent: ${userId}`, error)
      throw error
    }
  }
}
