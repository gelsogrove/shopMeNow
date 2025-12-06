/**
 * TrashController - Handles trash management endpoints
 *
 * Endpoints:
 * - POST /admin/users/{id}/unsubscribe - Initiate user deletion
 * - GET /admin/trash/customers - List deleted customers
 * - GET /admin/trash/workspaces - List deleted workspaces
 * - GET /admin/trash/agents - List deleted agents
 * - POST /admin/trash/{id}/restore - Restore soft-deleted item
 * - POST /admin/trash/{id}/permanently-delete - Hard-delete
 * - GET /admin/trash/audit-log - View deletion audit trail
 */

import { Request, Response } from "express"
import { PrismaClient } from "@echatbot/database"
import logger from "../../../utils/logger"
import { UserUnsubscribeService } from "../../../services/user-unsubscribe.service"
import { TrashRestoreService } from "../../../services/trash-restore.service"
import { buildTrashFilter, getDaysUntilPermanentDelete, getRetentionDaysConfig } from "../../../utils/soft-delete.helper"

export class TrashController {
  private unsubscribeService: UserUnsubscribeService
  private restoreService: TrashRestoreService

  constructor(private prisma: PrismaClient) {
    this.unsubscribeService = new UserUnsubscribeService(prisma)
    this.restoreService = new TrashRestoreService(prisma)
  }

  /**
   * POST /admin/users/{id}/unsubscribe
   * Initiate user account deletion (soft-delete with cascade)
   */
  async unsubscribeUser(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params
      const { reason = "User requested deletion" } = req.body

      const result = await this.unsubscribeService.unsubscribeUser(userId, reason)

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error("Failed to unsubscribe user", error)
      res.status(400).json({
        error: "Failed to unsubscribe user",
        message: String(error),
      })
    }
  }

  /**
   * GET /admin/trash/customers?workspaceId=xxx&page=1&limit=50
   * List soft-deleted customers
   * workspaceId is optional - if not provided, shows ALL deleted customers (Platform Admin view)
   */
  async listDeletedCustomers(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, page = "1", limit = "50" } = req.query
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
      const pageSize = Math.min(100, parseInt(limit as string, 10) || 50)

      // Build where clause - workspaceId is optional for Platform Admin
      const whereClause: any = {
        ...buildTrashFilter(),
      }
      if (workspaceId) {
        whereClause.workspaceId = workspaceId as string
      }

      const [items, total] = await Promise.all([
        this.prisma.customers.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            deletedAt: true,
            language: true,
            workspaceId: true,
            workspace: {
              select: {
                name: true,
              },
            },
          },
          skip: (pageNum - 1) * pageSize,
          take: pageSize,
          orderBy: { deletedAt: "desc" },
        }),
        this.prisma.customers.count({
          where: whereClause,
        }),
      ])

      const retentionDays = getRetentionDaysConfig()

      res.status(200).json({
        items: items.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          deletedAt: c.deletedAt,
          language: c.language,
          workspaceId: c.workspaceId,
          workspaceName: c.workspace?.name || 'Unknown',
          daysUntilPermanentDelete: getDaysUntilPermanentDelete(c.deletedAt!, retentionDays),
        })),
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      })
    } catch (error) {
      logger.error("Failed to list deleted customers", error)
      res.status(500).json({
        error: "Failed to list deleted customers",
        message: String(error),
      })
    }
  }

  /**
   * GET /admin/trash/workspaces?page=1&limit=50
   * List soft-deleted workspaces
   * 
   * FILTERING LOGIC:
   * Only shows workspaces that were deleted DIRECTLY (not as cascade from owner deletion).
   * A workspace appears here only if its owner is NOT deleted.
   * If owner is deleted, the workspace restore must happen via User restore (cascade).
   */
  async listDeletedWorkspaces(req: Request, res: Response): Promise<void> {
    try {
      const { page = "1", limit = "50" } = req.query
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
      const pageSize = Math.min(100, parseInt(limit as string, 10) || 50)

      // Filter: workspace deleted BUT owner NOT deleted (direct deletion, not cascade)
      const whereClause = {
        ...buildTrashFilter(),
        owner: {
          deletedAt: null, // Owner must NOT be deleted
        },
      }

      const [items, total] = await Promise.all([
        this.prisma.workspace.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            deletedAt: true,
            owner: {
              select: {
                email: true,
              },
            },
          },
          skip: (pageNum - 1) * pageSize,
          take: pageSize,
          orderBy: { deletedAt: "desc" },
        }),
        this.prisma.workspace.count({
          where: whereClause,
        }),
      ])

      const retentionDays = getRetentionDaysConfig()

      res.status(200).json({
        items: items.map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          ownerId: w.ownerId,
          ownerEmail: w.owner?.email || 'Unknown',
          deletedAt: w.deletedAt,
          daysUntilPermanentDelete: getDaysUntilPermanentDelete(w.deletedAt!, retentionDays),
        })),
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      })
    } catch (error) {
      logger.error("Failed to list deleted workspaces", error)
      res.status(500).json({
        error: "Failed to list deleted workspaces",
        message: String(error),
      })
    }
  }

  /**
   * GET /admin/trash/users?page=1&limit=50
   * List soft-deleted users
   * 
   * FILTERING LOGIC:
   * - OWNER users: Always shown if deleted (they are the root of cascade)
   * - AGENT/OPERATOR users: Only shown if deleted DIRECTLY (not via workspace cascade)
   *   An agent/operator appears only if ALL their workspaces are NOT deleted.
   */
  async listDeletedUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page = "1", limit = "50" } = req.query
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
      const pageSize = Math.min(100, parseInt(limit as string, 10) || 50)

      // First, get all deleted users
      const allDeletedUsers = await this.prisma.user.findMany({
        where: buildTrashFilter(),
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          deletedAt: true,
          workspaces: {
            select: {
              workspace: {
                select: {
                  id: true,
                  name: true,
                  deletedAt: true, // Need to check if workspace is deleted
                },
              },
              role: true,
            },
          },
        },
        orderBy: { deletedAt: "desc" },
      })

      // Filter: Show user only if they are NOT a cascade victim
      // A user is a cascade victim if:
      // - They are AGENT/OPERATOR AND all their workspaces are deleted
      const filteredUsers = allDeletedUsers.filter(user => {
        // OWNER/ADMIN role users are always shown (they are the root)
        // Note: isPlatformAdmin is a separate boolean field, not a role value
        if (user.role === 'OWNER' || user.role === 'ADMIN') {
          return true
        }
        
        // For AGENT/OPERATOR: check if ANY of their workspaces is NOT deleted
        // If at least one workspace is active, they were deleted directly
        const hasActiveWorkspace = user.workspaces.some(uw => uw.workspace.deletedAt === null)
        
        // If they have no workspaces or all workspaces are deleted, they're cascade victims
        if (user.workspaces.length === 0) {
          return true // No workspace = direct deletion
        }
        
        return hasActiveWorkspace
      })

      // Apply pagination to filtered results
      const total = filteredUsers.length
      const paginatedUsers = filteredUsers.slice((pageNum - 1) * pageSize, pageNum * pageSize)

      const retentionDays = getRetentionDaysConfig()

      res.status(200).json({
        items: paginatedUsers.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          role: u.role,
          deletedAt: u.deletedAt,
          workspaces: u.workspaces.map(w => ({
            id: w.workspace.id,
            name: w.workspace.name,
            role: w.role,
          })),
          daysUntilPermanentDelete: getDaysUntilPermanentDelete(u.deletedAt!, retentionDays),
        })),
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      })
    } catch (error) {
      logger.error("Failed to list deleted users", error)
      res.status(500).json({
        error: "Failed to list deleted users",
        message: String(error),
      })
    }
  }

  /**
   * POST /admin/trash/{id}/restore
   * Restore soft-deleted customer, workspace, or user
   */
  async restoreItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { workspaceId, entityType = "CUSTOMER" } = req.body

      let result
      if (entityType === "WORKSPACE") {
        // For workspace restore, the id IS the workspaceId
        result = await this.restoreService.restoreWorkspace(id, req.user?.id)
      } else if (entityType === "USER") {
        // For user restore
        result = await this.restoreUser(id, req.user?.id)
      } else {
        // For customer restore, workspaceId is required
        if (!workspaceId) {
          res.status(400).json({ error: "workspaceId required for customer restore" })
          return
        }
        result = await this.restoreService.restoreCustomer(id, workspaceId)
      }

      res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error("Failed to restore item", error)
      res.status(400).json({
        error: "Failed to restore item",
        message: String(error),
      })
    }
  }

  /**
   * Restore a soft-deleted user with CASCADE restore
   * Restores: User → All owned Workspaces → All workspace data (customers, orders, etc.)
   */
  private async restoreUser(userId: string, adminUserId?: string): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        throw new Error(`User not found: ${userId}`)
      }

      if (user.deletedAt === null) {
        throw new Error(`User not deleted: ${userId}`)
      }

      // 1. Restore the user
      await tx.user.update({
        where: { id: userId },
        data: { deletedAt: null },
      })

      // 2. CASCADE: Restore all workspaces owned by this user
      const ownedWorkspaces = await tx.workspace.findMany({
        where: { 
          ownerId: userId,
          deletedAt: { not: null }
        },
        select: { id: true, name: true }
      })

      const cascadeRestored = {
        workspaces: 0,
        customers: 0,
        orders: 0,
        chatSessions: 0,
        messages: 0,
      }

      for (const workspace of ownedWorkspaces) {
        // Restore workspace
        await tx.workspace.update({
          where: { id: workspace.id },
          data: { 
            deletedAt: null,
            isDelete: false  // Sync both fields
          }
        })
        cascadeRestored.workspaces++

        // Restore all customers in this workspace
        const customerResult = await tx.customers.updateMany({
          where: { workspaceId: workspace.id, deletedAt: { not: null } },
          data: { deletedAt: null }
        })
        cascadeRestored.customers += customerResult.count

        // Restore all orders in this workspace
        const orderResult = await tx.orders.updateMany({
          where: { workspaceId: workspace.id, deletedAt: { not: null } },
          data: { deletedAt: null }
        })
        cascadeRestored.orders += orderResult.count

        // Restore all chat sessions in this workspace
        const sessionResult = await tx.chatSession.updateMany({
          where: { workspaceId: workspace.id, deletedAt: { not: null } },
          data: { deletedAt: null }
        })
        cascadeRestored.chatSessions += sessionResult.count

        // Restore all messages in this workspace's sessions
        const messageResult = await tx.message.updateMany({
          where: { 
            chatSession: { workspaceId: workspace.id },
            deletedAt: { not: null } 
          },
          data: { deletedAt: null }
        })
        cascadeRestored.messages += messageResult.count
      }

      // Get first workspace for audit log
      const userWorkspace = await tx.userWorkspace.findFirst({
        where: { userId },
        select: { workspaceId: true },
      })

      // Audit log
      if (userWorkspace) {
        await tx.softDeleteAuditLog.create({
          data: {
            workspaceId: userWorkspace.workspaceId,
            entityType: "USER_RESTORED_CASCADE",
            deletedIds: [userId, ...ownedWorkspaces.map(w => w.id)],
            deletedIdCount: 1 + ownedWorkspaces.length,
            reason: `Admin initiated cascade restore (${adminUserId || 'system'})`,
            deletedByUserId: adminUserId || null,
          },
        })
      }

      return {
        success: true,
        message: "User and all owned workspaces restored successfully",
        entityType: "USER",
        cascadeRestored,
        restoredAt: new Date(),
      }
    })
  }

  /**
   * POST /admin/trash/{id}/permanently-delete
   * Hard-delete soft-deleted item (requires confirmation text)
   */
  async permanentlyDeleteItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { workspaceId, confirmationText = "", entityType = "CUSTOMER" } = req.body

      // Require exact confirmation text
      if (confirmationText !== "PERMANENTLY DELETE") {
        res.status(400).json({
          error: "Invalid confirmation",
          message: 'Must type "PERMANENTLY DELETE" to confirm',
        })
        return
      }

      // Hard-delete based on entity type
      let deletedCount = 0

      if (entityType === "CUSTOMER") {
        // Delete customer and all related data
        await this.prisma.$transaction(async (tx) => {
          await tx.message.deleteMany({
            where: { chatSession: { customerId: id } },
          })
          await tx.chatSession.deleteMany({ where: { customerId: id } })
          await tx.orderItems.deleteMany({
            where: { order: { customerId: id } },
          })
          await tx.orders.deleteMany({ where: { customerId: id } })
          const customer = await tx.customers.delete({ where: { id } })
          deletedCount++

          // Audit log
          await tx.softDeleteAuditLog.create({
            data: {
              workspaceId,
              entityType: "CUSTOMER_PERMANENTLY_DELETED",
              deletedIds: [id],
              deletedIdCount: deletedCount,
              reason: "Admin permanently deleted via trash",
              deletedByUserId: req.user?.id,
            },
          })
        })
      } else if (entityType === "WORKSPACE") {
        // Delete entire workspace and ALL related data
        await this.prisma.$transaction(async (tx) => {
          const wsId = id
          
          // ===== LEAF TABLES FIRST =====
          // Messages
          await tx.message.deleteMany({
            where: { chatSession: { workspaceId: wsId } },
          })
          
          // ConversationMessage
          await tx.conversationMessage.deleteMany({ where: { workspaceId: wsId } })
          
          // AgentConversationLog
          await tx.agentConversationLog.deleteMany({ where: { workspaceId: wsId } })
          
          // Chat sessions
          await tx.chatSession.deleteMany({ where: { workspaceId: wsId } })
          
          // Campaign tables
          await tx.campaignSent.deleteMany({
            where: { campaign: { workspaceId: wsId } },
          })
          await tx.campaign.deleteMany({ where: { workspaceId: wsId } })
          
          // Product relation tables
          await tx.productCertification.deleteMany({
            where: { product: { workspaceId: wsId } },
          })
          await tx.productTransportType.deleteMany({
            where: { product: { workspaceId: wsId } },
          })
          await tx.productCategory.deleteMany({
            where: { product: { workspaceId: wsId } },
          })
          
          // Cart tables
          await tx.cartItems.deleteMany({
            where: { cart: { workspaceId: wsId } },
          })
          await tx.carts.deleteMany({ where: { workspaceId: wsId } })
          
          // Order tables
          await tx.creditNote.deleteMany({
            where: { order: { workspaceId: wsId } },
          })
          await tx.orderItems.deleteMany({
            where: { order: { workspaceId: wsId } },
          })
          await tx.orders.deleteMany({ where: { workspaceId: wsId } })
          
          // Customer-related
          await tx.customerFeedback.deleteMany({
            where: { customer: { workspaceId: wsId } },
          })
          await tx.searchConversations.deleteMany({ where: { workspaceId: wsId } })
          await tx.customers.deleteMany({ where: { workspaceId: wsId } })
          
          // ===== CONTENT TABLES =====
          await tx.certification.deleteMany({ where: { workspaceId: wsId } })
          await tx.transportType.deleteMany({ where: { workspaceId: wsId } })
          await tx.products.deleteMany({ where: { workspaceId: wsId } })
          await tx.categories.deleteMany({ where: { workspaceId: wsId } })
          await tx.offers.deleteMany({ where: { workspaceId: wsId } })
          await tx.services.deleteMany({ where: { workspaceId: wsId } })
          await tx.fAQ.deleteMany({ where: { workspaceId: wsId } })
          await tx.documents.deleteMany({ where: { workspaceId: wsId } })
          await tx.suppliers.deleteMany({ where: { workspaceId: wsId } })
          await tx.sales.deleteMany({ where: { workspaceId: wsId } })
          await tx.languages.deleteMany({ where: { workspaceId: wsId } })
          
          // ===== CONFIG TABLES =====
          await tx.agentConfig.deleteMany({ where: { workspaceId: wsId } })
          await tx.whatsappSettings.deleteMany({ where: { workspaceId: wsId } })
          await tx.gdprContent.deleteMany({ where: { workspaceId: wsId } })
          
          // ===== OPERATIONAL TABLES =====
          await tx.whatsAppQueue.deleteMany({ where: { workspaceId: wsId } })
          await tx.productSearch.deleteMany({ where: { workspaceId: wsId } })
          await tx.secureToken.deleteMany({ where: { workspaceId: wsId } })
          await tx.shortUrls.deleteMany({ where: { workspaceId: wsId } })
          await tx.usage.deleteMany({ where: { workspaceId: wsId } })
          await tx.billing.deleteMany({ where: { workspaceId: wsId } })
          await tx.billingTransaction.deleteMany({ where: { workspaceId: wsId } })
          await tx.adminSession.deleteMany({ where: { workspaceId: wsId } })
          await tx.workspaceInvitation.deleteMany({ where: { workspaceId: wsId } })
          await tx.registrationAttempts.deleteMany({ where: { workspaceId: wsId } })
          await tx.registrationToken.deleteMany({ where: { workspaceId: wsId } })
          await tx.softDeleteAuditLog.deleteMany({ where: { workspaceId: wsId } })
          
          // ===== RELATIONS =====
          await tx.userWorkspace.deleteMany({ where: { workspaceId: wsId } })
          
          // ===== FINALLY DELETE WORKSPACE =====
          await tx.workspace.delete({ where: { id: wsId } })
          
          deletedCount = 1
        }, { timeout: 60000 })
      } else if (entityType === "USER") {
        // Delete user and all owned workspaces (cascade)
        await this.prisma.$transaction(async (tx) => {
          // First, find all workspaces owned by this user
          const ownedWorkspaces = await tx.workspace.findMany({
            where: { ownerId: id },
            select: { id: true },
          })

          // ===== USER AUTH TABLES =====
          await tx.twoFactorResetToken.deleteMany({ where: { userId: id } })
          await tx.authenticationAttempt.deleteMany({ where: { userId: id } })
          await tx.passwordReset.deleteMany({ where: { userId: id } })
          // Note: RegistrationToken is linked to Workspace, not User - deleted with workspace

          // Delete all data in each owned workspace
          for (const workspace of ownedWorkspaces) {
            const wsId = workspace.id
            
            // ===== LEAF TABLES FIRST =====
            await tx.message.deleteMany({
              where: { chatSession: { workspaceId: wsId } },
            })
            await tx.conversationMessage.deleteMany({ where: { workspaceId: wsId } })
            await tx.agentConversationLog.deleteMany({ where: { workspaceId: wsId } })
            await tx.chatSession.deleteMany({ where: { workspaceId: wsId } })
            
            // Campaign tables
            await tx.campaignSent.deleteMany({
              where: { campaign: { workspaceId: wsId } },
            })
            await tx.campaign.deleteMany({ where: { workspaceId: wsId } })
            
            // Product relation tables
            await tx.productCertification.deleteMany({
              where: { product: { workspaceId: wsId } },
            })
            await tx.productTransportType.deleteMany({
              where: { product: { workspaceId: wsId } },
            })
            await tx.productCategory.deleteMany({
              where: { product: { workspaceId: wsId } },
            })
            
            // Cart tables
            await tx.cartItems.deleteMany({
              where: { cart: { workspaceId: wsId } },
            })
            await tx.carts.deleteMany({ where: { workspaceId: wsId } })
            
            // Order tables
            await tx.creditNote.deleteMany({
              where: { order: { workspaceId: wsId } },
            })
            await tx.orderItems.deleteMany({
              where: { order: { workspaceId: wsId } },
            })
            await tx.orders.deleteMany({ where: { workspaceId: wsId } })
            
            // Customer-related
            await tx.customerFeedback.deleteMany({
              where: { customer: { workspaceId: wsId } },
            })
            await tx.searchConversations.deleteMany({ where: { workspaceId: wsId } })
            await tx.customers.deleteMany({ where: { workspaceId: wsId } })
            
            // ===== CONTENT TABLES =====
            await tx.certification.deleteMany({ where: { workspaceId: wsId } })
            await tx.transportType.deleteMany({ where: { workspaceId: wsId } })
            await tx.products.deleteMany({ where: { workspaceId: wsId } })
            await tx.categories.deleteMany({ where: { workspaceId: wsId } })
            await tx.offers.deleteMany({ where: { workspaceId: wsId } })
            await tx.services.deleteMany({ where: { workspaceId: wsId } })
            await tx.fAQ.deleteMany({ where: { workspaceId: wsId } })
            await tx.documents.deleteMany({ where: { workspaceId: wsId } })
            await tx.suppliers.deleteMany({ where: { workspaceId: wsId } })
            await tx.sales.deleteMany({ where: { workspaceId: wsId } })
            await tx.languages.deleteMany({ where: { workspaceId: wsId } })
            
            // ===== CONFIG TABLES =====
            await tx.agentConfig.deleteMany({ where: { workspaceId: wsId } })
            await tx.whatsappSettings.deleteMany({ where: { workspaceId: wsId } })
            await tx.gdprContent.deleteMany({ where: { workspaceId: wsId } })
            
            // ===== OPERATIONAL TABLES =====
            await tx.whatsAppQueue.deleteMany({ where: { workspaceId: wsId } })
            await tx.productSearch.deleteMany({ where: { workspaceId: wsId } })
            await tx.secureToken.deleteMany({ where: { workspaceId: wsId } })
            await tx.shortUrls.deleteMany({ where: { workspaceId: wsId } })
            await tx.usage.deleteMany({ where: { workspaceId: wsId } })
            await tx.billing.deleteMany({ where: { workspaceId: wsId } })
            await tx.billingTransaction.deleteMany({ where: { workspaceId: wsId } })
            await tx.adminSession.deleteMany({ where: { workspaceId: wsId } })
            await tx.workspaceInvitation.deleteMany({ where: { workspaceId: wsId } })
            await tx.registrationAttempts.deleteMany({ where: { workspaceId: wsId } })
            await tx.registrationToken.deleteMany({ where: { workspaceId: wsId } })
            await tx.softDeleteAuditLog.deleteMany({ where: { workspaceId: wsId } })
            
            // Delete user-workspace associations for this workspace
            await tx.userWorkspace.deleteMany({ where: { workspaceId: wsId } })
          }

          // Delete all owned workspaces
          await tx.workspace.deleteMany({ where: { ownerId: id } })

          // Delete user-workspace associations for this user (other workspaces)
          await tx.userWorkspace.deleteMany({ where: { userId: id } })

          // Finally delete the user
          await tx.user.delete({ where: { id } })

          deletedCount = 1 + ownedWorkspaces.length
        }, { timeout: 60000 })
      }

      res.status(200).json({
        success: true,
        message: `Item permanently deleted`,
        deletedCount,
        permanentlyDeletedAt: new Date(),
      })
    } catch (error) {
      logger.error("Failed to permanently delete item", error)
      res.status(400).json({
        error: "Failed to permanently delete item",
        message: String(error),
      })
    }
  }

  /**
   * GET /admin/trash/audit-log?workspaceId=xxx&days=30
   * View deletion audit trail
   */
  async getAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, days = "30" } = req.query
      const daysNum = Math.max(1, parseInt(days as string, 10) || 30)

      if (!workspaceId) {
        res.status(400).json({ error: "workspaceId required" })
        return
      }

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysNum)

      const logs = await this.prisma.softDeleteAuditLog.findMany({
        where: {
          workspaceId: workspaceId as string,
          deletedAt: {
            gte: cutoffDate,
          },
        },
        select: {
          id: true,
          entityType: true,
          deletedIds: true,
          deletedIdCount: true,
          reason: true,
          deletedByUserId: true,
          deletedAt: true,
        },
        orderBy: { deletedAt: "desc" },
        take: 100,
      })

      res.status(200).json({
        logs,
        daysShown: daysNum,
        totalCount: logs.length,
      })
    } catch (error) {
      logger.error("Failed to get audit log", error)
      res.status(500).json({
        error: "Failed to get audit log",
        message: String(error),
      })
    }
  }
}
