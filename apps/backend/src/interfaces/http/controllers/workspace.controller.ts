import { prisma } from "@echatbot/database"
import { NextFunction, Request, Response } from "express"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import { WorkspaceService } from "../../../application/services/workspace.service"
import { workspaceMemberService } from "../../../application/services/workspace-member.service"
import logger from "../../../utils/logger"
import { storageService } from "../../../services/storage.service"
import fs from "fs/promises"

// prisma imported

export class WorkspaceController {
  private workspaceService: WorkspaceService
  private billingService: SubscriptionBillingService

  constructor() {
    this.workspaceService = new WorkspaceService()
    this.billingService = new SubscriptionBillingService(prisma)
  }

  /**
   * Get all workspaces
   * SECURITY: Returns ONLY workspaces the authenticated user has access to
   */
  getAllWorkspaces = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // CRITICAL SECURITY: Get userId from authenticated request
      const userId = (req as any).user?.id
      if (!userId) {
        logger.error("User ID not found in request - authentication failed")
        return res.status(401).json({ error: "User not authenticated" })
      }

      logger.info(`Getting workspaces for user: ${userId}`)
      
      // WORKSPACE ISOLATION: Fetch ONLY workspaces this user has access to
      const workspaces = await this.workspaceService.getByUserId(userId)

      // Serialize workspaces to plain objects with all properties
      const serializedWorkspaces = workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        whatsappPhoneNumber: workspace.whatsappPhoneNumber,
        whatsappApiKey: workspace.whatsappApiKey, // ✅ FIXED: Use whatsappApiKey instead of whatsappApiToken
        webhookUrl: workspace.webhookUrl,
        notificationEmail: workspace.notificationEmail,
        adminEmail: workspace.adminEmail, // Explicitly include adminEmail
        language: workspace.language,
        currency: workspace.currency,
        messageLimit: workspace.messageLimit,
        blocklist: workspace.blocklist,
        welcomeMessage: workspace.welcomeMessage,
        wipMessage: workspace.wipMessage,
        channelStatus: workspace.channelStatus,
        isActive: workspace.isActive,
        isDelete: workspace.isDelete,
        url: workspace.url,
        debugMode: workspace.debugMode,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        planType: workspace.planType,
        trialEndsAt: workspace.trialEndsAt,
        // 🆕 Channel Configuration (Feature 199)
        sellsProductsAndServices: workspace.sellsProductsAndServices,
        hasSalesAgents: workspace.hasSalesAgents,
        hasHumanSupport: workspace.hasHumanSupport,
        humanSupportInstructions: workspace.humanSupportInstructions,
        frustrationEscalationInstructions: workspace.frustrationEscalationInstructions, // 🆕 Feature 203
        operatorContactMethod: workspace.operatorContactMethod,
        operatorWhatsappNumber: workspace.operatorWhatsappNumber,
        toneOfVoice: workspace.toneOfVoice,
        botIdentityResponse: workspace.botIdentityResponse,
        address: workspace.address,
        customAiRules: workspace.customAiRules,
        logoUrl: workspace.logoUrl,
      }))

      return res.json(serializedWorkspaces)
    } catch (error) {
      logger.error("Error fetching workspaces:", error)
      return next(error)
    }
  }

  /**
   * Get a workspace by ID
   */
  getWorkspaceById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params
      logger.info(`Getting workspace ${id}`)

      if (!id) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        const workspace = await this.workspaceService.getById(id)

        if (!workspace) {
          return res.status(404).json({ message: "Workspace not found" })
        }

        // Serialize workspace to plain object with all properties
        const serializedWorkspace = {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          whatsappPhoneNumber: workspace.whatsappPhoneNumber,
          whatsappApiKey: workspace.whatsappApiKey, // ✅ FIXED: Use whatsappApiKey instead of whatsappApiToken
          webhookUrl: workspace.webhookUrl,
          notificationEmail: workspace.notificationEmail,
          adminEmail: workspace.adminEmail, // Explicitly include adminEmail
          language: workspace.language,
          currency: workspace.currency,
          messageLimit: workspace.messageLimit,
          blocklist: workspace.blocklist,
          welcomeMessage: workspace.welcomeMessage,
          wipMessage: workspace.wipMessage,
          channelStatus: workspace.channelStatus,
          isActive: workspace.isActive,
          isDelete: workspace.isDelete,
          url: workspace.url,
          debugMode: workspace.debugMode,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          allowedExternalLinks: workspace.allowedExternalLinks,
          // 🆕 Channel Configuration (Feature 199)
          sellsProductsAndServices: workspace.sellsProductsAndServices,
          hasSalesAgents: workspace.hasSalesAgents,
          hasHumanSupport: workspace.hasHumanSupport,
          humanSupportInstructions: workspace.humanSupportInstructions,
          frustrationEscalationInstructions: workspace.frustrationEscalationInstructions, // 🆕 Feature 203
          operatorContactMethod: workspace.operatorContactMethod,
          operatorWhatsappNumber: workspace.operatorWhatsappNumber,
          toneOfVoice: workspace.toneOfVoice,
          botIdentityResponse: workspace.botIdentityResponse,
          address: workspace.address,
          customAiRules: workspace.customAiRules,
          logoUrl: workspace.logoUrl,
          // 🆕 Widget Settings
          widgetLogoUrl: workspace.widgetLogoUrl ?? null,
          widgetLogoKey: workspace.widgetLogoKey ?? null,
          widgetTitle: workspace.widgetTitle ?? null,
          widgetLanguage: workspace.widgetLanguage ?? "it",
          widgetPrimaryColor: workspace.widgetPrimaryColor ?? "#22c55e",
          // 🆕 Translation Settings
          translateProductNames: workspace.translateProductNames,
          translateCategoryNames: workspace.translateCategoryNames,
          translateServiceNames: workspace.translateServiceNames,
          catalogBaseLanguage: workspace.catalogBaseLanguage,
        }

        return res.json(serializedWorkspace)
      } catch (serviceError) {
        logger.error(`Service error fetching workspace ${id}:`, serviceError)
        // Restituisci un errore più specifico basato sull'errore del servizio
        return res.status(500).json({
          error: "Failed to retrieve workspace",
          details:
            serviceError instanceof Error
              ? serviceError.message
              : "Unknown error",
        })
      }
    } catch (error) {
      logger.error(
        `Error in workspace controller for ID ${req.params.id}:`,
        error
      )
      return next(error)
    }
  }

  /**
   * Create a new workspace
   * CRITICAL: Must create UserWorkspace relation for the creator
   * SECURITY: Only SUPER_ADMIN (owners) or first-time users can create workspaces
   */
  createWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info("Creating new workspace")
      
      // CRITICAL SECURITY: Get userId from authenticated request
      const userId = (req as any).user?.id
      if (!userId) {
        logger.error("User ID not found in request - authentication failed")
        return res.status(401).json({ error: "User not authenticated" })
      }

      // 🔒 SECURITY CHECK: Verify user can create workspaces
      // Only SUPER_ADMIN (owners) or first-time users can create channels
      const { canCreate, reason, isFirstTimeOwner } = await workspaceMemberService.canUserCreateWorkspace(userId)
      
      if (!canCreate) {
        logger.warn(`❌ User ${userId} attempted to create workspace but is not authorized: ${reason}`)
        return res.status(403).json({ 
          error: "Not authorized to create channels",
          message: reason 
        })
      }

      // 💰 BILLING CHECK: Verify channels limit (skip for first-time owners with no workspace yet)
      if (!isFirstTimeOwner) {
        // Get user's existing workspaces to check limit
        const existingWorkspaces = await this.workspaceService.getByUserId(userId)
        if (existingWorkspaces && existingWorkspaces.length > 0) {
          const firstWorkspaceId = existingWorkspaces[0].id
          const limitCheck = await this.billingService.checkPlanLimits(firstWorkspaceId, "channels")
          
          if (!limitCheck.withinLimits) {
            logger.warn(`❌ User ${userId} exceeded channels limit: ${limitCheck.current}/${limitCheck.max}`)
            return res.status(403).json({
              error: "Plan limit reached",
              message: `Channel limit reached: ${limitCheck.current}/${limitCheck.max}`,
              code: "CHANNEL_LIMIT_EXCEEDED",
            })
          }
        }
      }

      logger.info(`✅ User ${userId} authorized to create workspace (firstTimeOwner: ${isFirstTimeOwner})`)

      const workspaceData = req.body

      // Create workspace with user relation
      const workspace = await this.workspaceService.create({
        ...workspaceData,
        createdBy: userId, // Pass userId to service
      })
      
      logger.info(`✅ Workspace created: ${workspace.id} for user ${userId}`)
      return res.status(201).json(workspace)
    } catch (error) {      logger.error("❌ Error creating workspace:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as any).user?.id,
        body: req.body,
      })
      return next(error)
    }
  }

  /**
   * Update a workspace
   */
  updateWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const workspaceData = req.body

      // 🔒 SECURITY CHECK
      logger.error("=== SECURITY AUDIT ===")
      logger.error("User from req:", (req as any).user ? "✅ PRESENT" : "❌ MISSING")
      logger.error("Authorization header:", req.headers.authorization ? "✅ PRESENT" : "❌ MISSING")
      logger.error("Workspace ID from token:", (req as any).workspaceId)
      logger.error("Route called:", req.path)
      
      if (!(req as any).user) {
        logger.error("🚨 SECURITY BREACH: Update called without authentication!")
        return res.status(401).json({ message: "Unauthorized - No user in request" })
      }

      logger.info(`Updating workspace ${id}`)
      logger.info(
        `📦 Workspace data received: ${JSON.stringify(workspaceData, null, 2)}`
      )

      // 🔍 LOG SPECIFICO per whatsappApiKey
      logger.info("=== WHATSAPP API KEY DEBUG ===")
      logger.info(
        "whatsappApiKey presente nel body:",
        workspaceData.whatsappApiKey ? "✅ SÌ" : "❌ NO"
      )
      if (workspaceData.whatsappApiKey) {
        logger.info(
          "Lunghezza whatsappApiKey:",
          workspaceData.whatsappApiKey.length
        )
        logger.info(
          "Primi 10 caratteri:",
          workspaceData.whatsappApiKey.substring(0, 10) + "..."
        )
      }

      // 🔍 LOG SPECIFICO per Feature 199 fields
      logger.info("=== FEATURE 199 TOGGLE DEBUG ===")
      logger.info(`sellsProductsAndServices nel body: ${workspaceData.sellsProductsAndServices} (tipo: ${typeof workspaceData.sellsProductsAndServices})`)
      logger.info(`hasSalesAgents nel body: ${workspaceData.hasSalesAgents} (tipo: ${typeof workspaceData.hasSalesAgents})`)
      logger.info(`hasHumanSupport nel body: ${workspaceData.hasHumanSupport} (tipo: ${typeof workspaceData.hasHumanSupport})`)
      logger.info("operatorContactMethod nel body:", workspaceData.operatorContactMethod)

      const workspace = await this.workspaceService.update(id, workspaceData)

      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" })
      }

      // Serialize workspace to plain object with all properties (same as getWorkspaceById)
      const serializedWorkspace = {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        whatsappPhoneNumber: workspace.whatsappPhoneNumber,
        whatsappApiKey: workspace.whatsappApiKey,
        webhookUrl: workspace.webhookUrl,
        notificationEmail: workspace.notificationEmail,
        adminEmail: workspace.adminEmail,
        language: workspace.language,
        currency: workspace.currency,
        messageLimit: workspace.messageLimit,
        blocklist: workspace.blocklist,
        welcomeMessage: workspace.welcomeMessage,
        wipMessage: workspace.wipMessage,
        channelStatus: workspace.channelStatus,
        isActive: workspace.isActive,
        isDelete: workspace.isDelete,
        url: workspace.url,
        debugMode: workspace.debugMode,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        allowedExternalLinks: workspace.allowedExternalLinks,
        // 🆕 Channel Configuration (Feature 199)
        sellsProductsAndServices: workspace.sellsProductsAndServices,
        hasSalesAgents: workspace.hasSalesAgents,
        hasHumanSupport: workspace.hasHumanSupport,
        humanSupportInstructions: workspace.humanSupportInstructions,
        frustrationEscalationInstructions: workspace.frustrationEscalationInstructions, // 🆕 Feature 203
        operatorContactMethod: workspace.operatorContactMethod,
        operatorWhatsappNumber: workspace.operatorWhatsappNumber,
        toneOfVoice: workspace.toneOfVoice,
        botIdentityResponse: workspace.botIdentityResponse,
        address: workspace.address,
        customAiRules: workspace.customAiRules,
        logoUrl: workspace.logoUrl,
        // 🆕 Widget Settings
        widgetLogoUrl: workspace.widgetLogoUrl ?? null,
        widgetLogoKey: workspace.widgetLogoKey ?? null,
        widgetTitle: workspace.widgetTitle ?? null,
        widgetLanguage: workspace.widgetLanguage ?? "it",
        widgetPrimaryColor: workspace.widgetPrimaryColor ?? "#22c55e",
        // 🆕 Translation Settings
        translateProductNames: workspace.translateProductNames,
        translateCategoryNames: workspace.translateCategoryNames,
        translateServiceNames: workspace.translateServiceNames,
        catalogBaseLanguage: workspace.catalogBaseLanguage,
      }

      logger.info(
        `✅ Workspace serialized and ready to return: ${JSON.stringify(serializedWorkspace, null, 2)}`
      )
      return res.json(serializedWorkspace)
    } catch (error) {
      logger.error(`Error updating workspace ${req.params.id}:`, error)
      return next(error)
    }
  }

  /**
   * Delete a workspace
   * SECURITY: Only the workspace owner (SUPER_ADMIN) can delete a channel
   */
  deleteWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      // CRITICAL SECURITY: Get userId from authenticated request
      const userId = (req as any).user?.id
      if (!userId) {
        logger.error("User ID not found in request - authentication failed")
        return res.status(401).json({ error: "User not authenticated" })
      }

      logger.info(`User ${userId} attempting to delete workspace ${id}`)

      // 🔒 SECURITY CHECK: Only SUPER_ADMIN (owner) can delete workspace
      const isSuperAdmin = await workspaceMemberService.isSuperAdmin(id, userId)
      
      if (!isSuperAdmin) {
        logger.warn(`❌ User ${userId} attempted to delete workspace ${id} but is not the owner`)
        return res.status(403).json({ 
          error: "Not authorized to delete this channel",
          message: "Only workspace owners (SUPER_ADMIN) can delete channels" 
        })
      }

      logger.info(`✅ User ${userId} authorized to delete workspace ${id} (is owner)`)

      const result = await this.workspaceService.delete(id)

      if (!result) {
        return res.status(404).json({ message: "Workspace not found" })
      }

      logger.info(`✅ Workspace ${id} deleted by owner ${userId}`)
      return res.status(204).send()
    } catch (error) {
      logger.error(`Error deleting workspace ${req.params.id}:`, error)
      return next(error)
    }
  }

  /**
   * Upload workspace logo
   * SECURITY: Only SUPER_ADMIN (owner) can upload logo
   */
  uploadWorkspaceLogo = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params
      const userId = (req as any).user?.id

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" })
      }

      // Check if user is SUPER_ADMIN
      const isSuperAdmin = await workspaceMemberService.isSuperAdmin(id, userId)
      if (!isSuperAdmin) {
        return res.status(403).json({ error: "Only workspace owners can upload logo" })
      }

      const file = req.file
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" })
      }

      // Get current workspace to check for old logo
      const currentWorkspace = await prisma.workspace.findUnique({
        where: { id },
        select: { logoKey: true, logoUrl: true }
      })

      // Delete old logo if exists
      if (currentWorkspace?.logoUrl) {
        await storageService.deleteImage(currentWorkspace.logoUrl)
        logger.info(`Deleted old logo: ${currentWorkspace.logoUrl}`)
      }

      // Upload new logo via Storage Service
      const uploadedUrl = await storageService.uploadImage(file, 'users')

      // Update workspace with new logo URL and key
      const workspace = await this.workspaceService.update(id, { 
        logoUrl: uploadedUrl,
        logoKey: uploadedUrl // Store URL as key for compatibility
      })

      logger.info(`✅ Logo uploaded for workspace ${id}: ${uploadedUrl}`)
      return res.json({ logoUrl: workspace.logoUrl })
    } catch (error) {
      logger.error("Error uploading workspace logo:", error)
      return next(error)
    }
  }

  /**
   * Get badge stats for all user's workspaces
   * Returns counts for: unread messages, operator interventions needed, pending orders
   */
  getWorkspaceBadgeStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // CRITICAL SECURITY: Get userId from authenticated request
      const userId = (req as any).user?.id
      if (!userId) {
        logger.error("User ID not found in request - authentication failed")
        return res.status(401).json({ error: "User not authenticated" })
      }

      logger.info(`📊 Getting badge stats for user: ${userId}`)

      // Get all workspaces this user has access to
      const workspaces = await this.workspaceService.getByUserId(userId)
      const workspaceIds = workspaces.map((w) => w.id)

      if (workspaceIds.length === 0) {
        return res.json({})
      }

      // Get stats for each workspace in parallel
      const statsPromises = workspaceIds.map(async (workspaceId) => {
        const [unreadMessages, pendingOrders, needsIntervention, blockedUsers, newCustomers] =
          await Promise.all([
            // Count unread incoming messages (from customers)
            prisma.message.count({
              where: {
                read: false,
                direction: "INBOUND",
                chatSession: {
                  workspaceId,
                },
              },
            }),
            // Count pending orders
            prisma.orders.count({
              where: {
                workspaceId,
                status: "PENDING",
              },
            }),
            // Count customers needing operator intervention
            // Customers where activeChatbot = false (disabled chatbot, wants human)
            prisma.customers.count({
              where: {
                workspaceId,
                activeChatbot: false,
              },
            }),
            // Count blocked/blacklisted customers
            prisma.customers.count({
              where: {
                workspaceId,
                isBlacklisted: true,
              },
            }),
            // Count new customers (unregistered - name is "New Customer")
            prisma.customers.count({
              where: {
                workspaceId,
                name: "New Customer",
              },
            }),
          ])

        return {
          workspaceId,
          unreadMessages,
          pendingOrders,
          needsIntervention,
          blockedUsers,
          newCustomers,
        }
      })

      const allStats = await Promise.all(statsPromises)

      // Convert to a map for easy access
      const statsMap: Record<
        string,
        {
          unreadMessages: number
          pendingOrders: number
          needsIntervention: number
          blockedUsers: number
          newCustomers: number
        }
      > = {}
      allStats.forEach((stat) => {
        statsMap[stat.workspaceId] = {
          unreadMessages: stat.unreadMessages,
          pendingOrders: stat.pendingOrders,
          needsIntervention: stat.needsIntervention,
          blockedUsers: stat.blockedUsers,
          newCustomers: stat.newCustomers,
        }
      })

      logger.info(`📊 Badge stats retrieved for ${workspaceIds.length} workspaces`, statsMap)
      return res.json(statsMap)
    } catch (error) {
      logger.error("Error fetching workspace badge stats:", error)
      return next(error)
    }
  }
}
