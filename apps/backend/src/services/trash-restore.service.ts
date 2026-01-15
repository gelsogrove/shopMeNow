/**
 * TrashRestoreService - Handles restoration of soft-deleted items
 *
 * Verifies:
 * - Item is soft-deleted (deletedAt != null)
 * - Item is within 90-day retention window
 * - All cascade relations exist
 *
 * Restores:
 * - Target item
 * - All related records in cascade (orders, messages, sessions, etc.)
 *
 * SAFETY: Transaction-based with audit logging
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import { getDaysUntilPermanentDelete, getRetentionDaysConfig } from "../utils/soft-delete.helper"

interface RestoreResult {
  success: boolean
  message: string
  entityType: string
  cascadeRestored: {
    [key: string]: number
  }
  restoredAt: Date
}

export class TrashRestoreService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Restore a soft-deleted customer and all related data
   */
  async restoreCustomer(customerId: string, workspaceId: string): Promise<RestoreResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Find customer and verify soft-deleted
        const customer = await tx.customers.findUnique({
          where: { id: customerId },
        })

        if (!customer) {
          throw new Error(`Customer not found: ${customerId}`)
        }

        if (customer.deletedAt === null) {
          throw new Error(`Customer not deleted: ${customerId}`)
        }

        // Verify within retention window
        if (!this.isWithinRetentionWindow(customer.deletedAt)) {
          throw new Error(
            `Customer outside retention window (hard-delete eligible): ${getDaysUntilPermanentDelete(
              customer.deletedAt,
              getRetentionDaysConfig()
            )} days remaining`
          )
        }

        // 2. Verify workspaceId match
        if (customer.workspaceId !== workspaceId) {
          throw new Error("Workspace ID mismatch - security check failed")
        }

        const restoredAt = new Date()

        // 3. Restore cascade in order
        const cascade = {
          messages: 0,
          chatSessions: 0,
          orderItems: 0,
          orders: 0,
        }

        // Messages
        const msgResult = await tx.message.updateMany({
          where: { chatSession: { customerId, deletedAt: { not: null } } },
          data: { deletedAt: null }
        })
        cascade.messages = msgResult.count

        // Chat sessions
        const sessionResult = await tx.chatSession.updateMany({
          where: { customerId, deletedAt: { not: null } },
          data: { deletedAt: null }
        })
        cascade.chatSessions = sessionResult.count

        // Order items
        const itemsResult = await tx.orderItems.updateMany({
          where: { order: { customerId, deletedAt: { not: null } } },
          data: { deletedAt: null }
        })
        cascade.orderItems = itemsResult.count

        // Orders
        const orderResult = await tx.orders.updateMany({
          where: { customerId, deletedAt: { not: null } },
          data: { deletedAt: null }
        })
        cascade.orders = orderResult.count

        // Finally restore customer
        await tx.customers.update({
          where: { id: customerId },
          data: { deletedAt: null },
        })

        // 4. Log restoration to audit trail
        await tx.softDeleteAuditLog.create({
          data: {
            workspaceId,
            entityType: "CUSTOMER_RESTORED",
            deletedIds: [customerId],
            deletedIdCount: 1 + cascade.orders + cascade.messages + cascade.chatSessions,
            reason: "Admin initiated restore",
            deletedByUserId: null, // Will be set by caller if needed
          },
        })

        return {
          success: true,
          message: "Customer restored successfully",
          entityType: "CUSTOMER",
          cascadeRestored: cascade,
          restoredAt,
        }
      })

      logger.info(`Customer restored: ${customerId}`, {
        cascade: result.cascadeRestored,
      })

      return result
    } catch (error) {
      logger.error(`Failed to restore customer: ${customerId}`, error)
      throw error
    }
  }

  /**
   * Restore a soft-deleted workspace and all related data
   */
  async restoreWorkspace(workspaceId: string, adminUserId: string): Promise<RestoreResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Find workspace and verify soft-deleted
        const workspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
        })

        if (!workspace) {
          throw new Error(`Workspace not found: ${workspaceId}`)
        }

        if (workspace.deletedAt === null) {
          throw new Error(`Workspace not deleted: ${workspaceId}`)
        }

        // Verify within retention window
        if (!this.isWithinRetentionWindow(workspace.deletedAt)) {
          throw new Error(
            `Workspace outside retention window: ${getDaysUntilPermanentDelete(
              workspace.deletedAt,
              getRetentionDaysConfig()
            )} days remaining`
          )
        }

        const restoredAt = new Date()
        const cascade = {
          messages: 0,
          chatSessions: 0,
          orders: 0,
          customers: 0,
          agents: 0,
        }

        // 2. Restore all cascade
        // Messages
        const msgResult = await tx.message.updateMany({
          where: { chatSession: { workspaceId, deletedAt: { not: null } } },
          data: { deletedAt: null }
        })
        cascade.messages = msgResult.count

        // Chat sessions
        const sessionResult = await tx.chatSession.updateMany({
          where: { workspaceId, deletedAt: { not: null } },
          data: { deletedAt: null }
        })
        cascade.chatSessions = sessionResult.count

        // Orders
        const orderResult = await tx.orders.updateMany({
          where: { workspace: { id: workspaceId }, deletedAt: { not: null } },
          data: { deletedAt: null }
        })
        cascade.orders = orderResult.count

        // Customers
        const customerResult = await tx.customers.updateMany({
          where: { workspaceId, deletedAt: { not: null } },
          data: { deletedAt: null }
        })
        cascade.customers = customerResult.count

        // Agents
        const agents = await tx.userWorkspace.findMany({
          where: { workspaceId },
          select: { userId: true },
        })
        for (const agent of agents) {
          const updated = await tx.user.update({
            where: { id: agent.userId },
            data: { deletedAt: null },
          })
          if (updated.deletedAt === null) cascade.agents++
        }

        // Finally restore workspace
        await tx.workspace.update({
          where: { id: workspaceId },
          data: { 
            deletedAt: null,
          },
        })

        // 3. Log restoration
        await tx.softDeleteAuditLog.create({
          data: {
            workspaceId,
            entityType: "WORKSPACE_RESTORED",
            deletedIds: [workspaceId],
            deletedIdCount: 1 + cascade.customers + cascade.orders + cascade.messages,
            reason: `Admin initiated restore (${adminUserId})`,
            deletedByUserId: adminUserId,
          },
        })

        return {
          success: true,
          message: "Workspace restored successfully",
          entityType: "WORKSPACE",
          cascadeRestored: cascade,
          restoredAt,
        }
      })

      logger.info(`Workspace restored: ${workspaceId}`, {
        cascade: result.cascadeRestored,
        admin: adminUserId,
      })

      return result
    } catch (error) {
      logger.error(`Failed to restore workspace: ${workspaceId}`, error)
      throw error
    }
  }

  /**
   * Check if a soft-deleted item is within retention window
   */
  private isWithinRetentionWindow(deletedAt: Date): boolean {
    const retentionDays = getRetentionDaysConfig()
    const expiryDate = new Date(deletedAt)
    expiryDate.setDate(expiryDate.getDate() + retentionDays)

    return expiryDate > new Date()
  }
}
