import { PayPalStatus, prisma } from "@echatbot/database"
import { NextFunction, Request, Response } from "express"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import { WorkspaceChecklistService } from "../../../application/services/workspace-checklist.service"
import { WorkspaceService } from "../../../application/services/workspace.service"
import { workspaceMemberService } from "../../../application/services/workspace-member.service"
import logger from "../../../utils/logger"
import { storageService } from "../../../services/storage.service"
import fs from "fs/promises"

// prisma imported

export class WorkspaceController {
  private workspaceService: WorkspaceService
  private billingService: SubscriptionBillingService
  private checklistService: WorkspaceChecklistService

  constructor() {
    this.workspaceService = new WorkspaceService()
    this.billingService = new SubscriptionBillingService(prisma)
    this.checklistService = new WorkspaceChecklistService()
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

      // Fetch webhookIds for all workspaces from WhatsappSettings table
      const workspaceIds = workspaces.map(w => w.id)
      const whatsappSettings = await prisma.whatsappSettings.findMany({
        where: { workspaceId: { in: workspaceIds } },
        select: { workspaceId: true, webhookId: true }
      })
      const webhookIdMap = new Map(whatsappSettings.map(s => [s.workspaceId, s.webhookId]))

      // Serialize workspaces to plain objects with all properties
      const serializedWorkspaces = workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        whatsappPhoneNumber: workspace.whatsappPhoneNumber,
        whatsappApiKey: workspace.whatsappApiKey,
        whatsappAppName: workspace.whatsappAppName ?? null,
        whatsappAppSecret: workspace.whatsappAppSecret ?? null,
        whatsappPhoneNumberId: workspace.whatsappPhoneNumberId,
        whatsappBusinessAccountId: workspace.whatsappBusinessAccountId,
        whatsappVerifyToken: workspace.whatsappVerifyToken,
        webhookUrl: workspace.webhookUrl,
        whatsappWebhookToken: workspace.whatsappWebhookToken ?? null,
        notificationEmail: workspace.notificationEmail,
        adminEmail: workspace.adminEmail, // Explicitly include adminEmail
        language: workspace.language,
        defaultLanguage: workspace.defaultLanguage ?? "it", // 🌍 ISO-2 default language for customers
        currency: workspace.currency,
        messageLimit: workspace.messageLimit,
        blocklist: workspace.blocklist,
        welcomeMessage: workspace.welcomeMessage,
        wipMessage: workspace.wipMessage,
        channelStatus: workspace.channelStatus,
        url: workspace.url,
        debugMode: workspace.debugMode,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        planType: workspace.planType,
        trialEndsAt: workspace.trialEndsAt,
        // 🆕 Channel Configuration (Feature 199 + Andrea's wizard)
        channelType: workspace.channelType,
        enableWhatsapp: workspace.enableWhatsapp,
        enableWidget: workspace.enableWidget,
        sellsProductsAndServices: workspace.sellsProductsAndServices,
        hasSalesAgents: workspace.hasSalesAgents,
        hasHumanSupport: workspace.hasHumanSupport,
        humanSupportInstructions: workspace.humanSupportInstructions,
        frustrationEscalationInstructions: workspace.frustrationEscalationInstructions, // 🆕 Feature 203
        operatorContactMethod: workspace.operatorContactMethod,
        operatorEmail: workspace.operatorEmail,
        operatorWhatsappNumber: workspace.operatorWhatsappNumber,
        toneOfVoice: workspace.toneOfVoice,
        botIdentityResponse: workspace.botIdentityResponse,
        address: workspace.address,
        customAiRules: workspace.customAiRules,
        registrationPage: workspace.registrationPage ?? null,
        requireManualApproval: workspace.requireManualApproval ?? false,
        logoUrl: workspace.logoUrl,
        widgetTitle: workspace.widgetTitle ?? null,
        widgetLanguage: workspace.widgetLanguage ?? "it",
        widgetPrimaryColor: workspace.widgetPrimaryColor ?? "#22c55e",
        widgetIcon: workspace.widgetIcon ?? "chat",
        widgetUseChannelLogo: workspace.widgetUseChannelLogo ?? false,
        widgetAutoSuggestionsEnabled: workspace.widgetAutoSuggestionsEnabled ?? false,
        widgetQuickReplies: workspace.widgetQuickReplies ?? [],
        // 🆕 Multi-Provider WhatsApp Support
        whatsappProvider: workspace.whatsappProvider ?? "meta",
        ultraMsgInstanceId: workspace.ultraMsgInstanceId ?? null,
        ultraMsgToken: workspace.ultraMsgToken ?? null,
        ultraMsgApiUrl: workspace.ultraMsgApiUrl ?? null,
        // 🔧 FIX: Use REAL webhookId from WhatsappSettings, NOT workspace.id as fallback
        // If no WhatsappSettings exists, return null (UI will show "Not generated")
        whatsappWebhookId: webhookIdMap.get(workspace.id) ?? null,
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

        // 🔧 FIX: Load webhookId from WhatsappSettings table
        const whatsappSettings = await prisma.whatsappSettings.findUnique({
          where: { workspaceId: workspace.id },
          select: { webhookId: true }
        })

        // Serialize workspace to plain object with all properties
        const serializedWorkspace = {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          whatsappPhoneNumber: workspace.whatsappPhoneNumber,
          whatsappApiKey: workspace.whatsappApiKey,
          whatsappAppName: workspace.whatsappAppName ?? null,
          whatsappAppSecret: workspace.whatsappAppSecret ?? null,
          whatsappPhoneNumberId: workspace.whatsappPhoneNumberId,
          whatsappVerifyToken: workspace.whatsappVerifyToken,
          webhookUrl: workspace.webhookUrl,
          whatsappWebhookToken: workspace.whatsappWebhookToken ?? null,
          whatsappBusinessAccountId: workspace.whatsappBusinessAccountId ?? null,
          whatsappProvider: workspace.whatsappProvider ?? "meta",
          ultraMsgInstanceId: workspace.ultraMsgInstanceId ?? null,
          ultraMsgToken: workspace.ultraMsgToken ?? null,
          ultraMsgApiUrl: workspace.ultraMsgApiUrl ?? null,
          // 🔧 FIX: Use REAL webhookId from WhatsappSettings, NOT workspace.id
          whatsappWebhookId: whatsappSettings?.webhookId ?? null,
          notificationEmail: workspace.notificationEmail,
          adminEmail: workspace.adminEmail, // Explicitly include adminEmail
          language: workspace.language,
          defaultLanguage: workspace.defaultLanguage ?? "it", // 🌍 ISO-2 default language for customers
          currency: workspace.currency,
          messageLimit: workspace.messageLimit,
          blocklist: workspace.blocklist,
          welcomeMessage: workspace.welcomeMessage,
          wipMessage: workspace.wipMessage,
          channelStatus: workspace.channelStatus,
          url: workspace.url,
          debugMode: workspace.debugMode,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          allowedExternalLinks: workspace.allowedExternalLinks,
          // 🆕 Channel Configuration (Feature 199 + Andrea's wizard)
          channelType: workspace.channelType,
          enableWhatsapp: workspace.enableWhatsapp,
          enableWidget: workspace.enableWidget,
          sellsProductsAndServices: workspace.sellsProductsAndServices,
          hasSalesAgents: workspace.hasSalesAgents,
          hasHumanSupport: workspace.hasHumanSupport,
          humanSupportInstructions: workspace.humanSupportInstructions,
          frustrationEscalationInstructions: workspace.frustrationEscalationInstructions, // 🆕 Feature 203
          operatorContactMethod: workspace.operatorContactMethod,
          operatorEmail: workspace.operatorEmail,
          operatorWhatsappNumber: workspace.operatorWhatsappNumber,
          toneOfVoice: workspace.toneOfVoice,
          botIdentityResponse: workspace.botIdentityResponse,
          address: workspace.address,
          customAiRules: workspace.customAiRules,
          registrationPage: workspace.registrationPage ?? null,
          requireManualApproval: workspace.requireManualApproval ?? false,
          logoUrl: workspace.logoUrl,
          // 🆕 Chatbot Personalization
          chatbotName: workspace.chatbotName,
          businessType: workspace.businessType,
          // 🆕 Widget Settings
          widgetLogoUrl: workspace.widgetLogoUrl ?? null,
          widgetLogoKey: workspace.widgetLogoKey ?? null,
          widgetTitle: workspace.widgetTitle ?? null,
          widgetLanguage: workspace.widgetLanguage ?? "it",
          widgetPrimaryColor: workspace.widgetPrimaryColor ?? "#22c55e",
          widgetIcon: workspace.widgetIcon ?? "chat",
          widgetUseChannelLogo: workspace.widgetUseChannelLogo ?? false,
          widgetAutoSuggestionsEnabled: workspace.widgetAutoSuggestionsEnabled ?? false,
          widgetQuickReplies: workspace.widgetQuickReplies ?? [],
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
   * Get configuration checklist for a workspace
   */
  getWorkspaceChecklist = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params
      if (!id) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const checklist = await this.checklistService.getChecklist(id)
      return res.json({ success: true, data: checklist })
    } catch (error) {
      if (error instanceof Error && error.message === "Workspace not found") {
        return res.status(404).json({ error: "Workspace not found" })
      }
      logger.error("Error getting workspace checklist:", error)
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

      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { isPaymentConnected: true, paypalStatus: true, planType: true },
      })

      if (!owner) {
        return res.status(404).json({ error: "Owner not found" })
      }

      const ownerPlan = owner.planType || "FREE_TRIAL"
      const isFreePlan = ownerPlan === "FREE_TRIAL"
      const isPaymentConnected =
        owner.isPaymentConnected === true ||
        owner.paypalStatus === PayPalStatus.CONNECTED

      // PayPal required only for paid plans (BASIC/+) - allow FREE_TRIAL to create first channel
      if (!isFreePlan && !isPaymentConnected) {
        return res.status(403).json({
          error: "PayPal connection required",
          message: "Connect your PayPal account to create a new channel.",
          code: "PAYPAL_NOT_CONNECTED",
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

      // Validate wizard fields
      const validTones = ['formal', 'friendly', 'professional', 'casual']
      if (workspaceData.toneOfVoice && !validTones.includes(workspaceData.toneOfVoice)) {
        return res.status(400).json({
          error: 'Invalid tone of voice',
          message: `toneOfVoice must be one of: ${validTones.join(', ')}`
        })
      }

      if (workspaceData.botIdentityResponse && workspaceData.botIdentityResponse.length > 2000) {
        return res.status(400).json({
          error: 'Bot identity too long',
          message: 'botIdentityResponse must be 2000 characters or less'
        })
      }

      if (workspaceData.operatorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workspaceData.operatorEmail)) {
        return res.status(400).json({
          error: 'Invalid email',
          message: 'operatorEmail must be a valid email address'
        })
      }

      // Create workspace with user relation
      const workspace = await this.workspaceService.create({
        ...workspaceData,
        createdBy: userId, // Pass userId to service
      })

      logger.info(`✅ Workspace created: ${workspace.id} for user ${userId}`)

      // 🔧 FIX: Serialize domain entity to plain object (getters are NOT included by JSON.stringify)
      // Without this, frontend receives { props: { id, ... } } instead of { id, ... }
      const whatsappSettings = await prisma.whatsappSettings.findUnique({
        where: { workspaceId: workspace.id },
        select: { webhookId: true }
      })

      const serializedWorkspace = {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        whatsappPhoneNumber: workspace.whatsappPhoneNumber,
        whatsappApiKey: workspace.whatsappApiKey,
        whatsappAppName: workspace.whatsappAppName ?? null,
        whatsappAppSecret: workspace.whatsappAppSecret ?? null,
        whatsappPhoneNumberId: workspace.whatsappPhoneNumberId,
        whatsappVerifyToken: workspace.whatsappVerifyToken,
        webhookUrl: workspace.webhookUrl,
        whatsappWebhookToken: workspace.whatsappWebhookToken ?? null,
        whatsappBusinessAccountId: workspace.whatsappBusinessAccountId ?? null,
        whatsappProvider: workspace.whatsappProvider ?? "meta",
        ultraMsgInstanceId: workspace.ultraMsgInstanceId ?? null,
        ultraMsgToken: workspace.ultraMsgToken ?? null,
        ultraMsgApiUrl: workspace.ultraMsgApiUrl ?? null,
        whatsappWebhookId: whatsappSettings?.webhookId ?? null,
        notificationEmail: workspace.notificationEmail,
        adminEmail: workspace.adminEmail,
        language: workspace.language,
        defaultLanguage: workspace.defaultLanguage ?? "it",
        currency: workspace.currency,
        messageLimit: workspace.messageLimit,
        blocklist: workspace.blocklist,
        welcomeMessage: workspace.welcomeMessage,
        wipMessage: workspace.wipMessage,
        channelStatus: workspace.channelStatus,
        url: workspace.url,
        debugMode: workspace.debugMode,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        allowedExternalLinks: workspace.allowedExternalLinks,
        planType: workspace.planType,
        trialEndsAt: workspace.trialEndsAt,
        channelType: workspace.channelType,
        enableWhatsapp: workspace.enableWhatsapp,
        enableWidget: workspace.enableWidget,
        sellsProductsAndServices: workspace.sellsProductsAndServices,
        hasSalesAgents: workspace.hasSalesAgents,
        hasHumanSupport: workspace.hasHumanSupport,
        humanSupportInstructions: workspace.humanSupportInstructions,
        frustrationEscalationInstructions: workspace.frustrationEscalationInstructions,
        operatorContactMethod: workspace.operatorContactMethod,
        operatorEmail: workspace.operatorEmail,
        operatorWhatsappNumber: workspace.operatorWhatsappNumber,
        toneOfVoice: workspace.toneOfVoice,
        botIdentityResponse: workspace.botIdentityResponse,
        address: workspace.address,
        customAiRules: workspace.customAiRules,
        registrationPage: workspace.registrationPage ?? null,
        requireManualApproval: workspace.requireManualApproval ?? false,
        logoUrl: workspace.logoUrl,
        chatbotName: workspace.chatbotName,
        businessType: workspace.businessType,
        widgetLogoUrl: workspace.widgetLogoUrl ?? null,
        widgetLogoKey: workspace.widgetLogoKey ?? null,
        widgetTitle: workspace.widgetTitle ?? null,
        widgetLanguage: workspace.widgetLanguage ?? "it",
        widgetPrimaryColor: workspace.widgetPrimaryColor ?? "#22c55e",
        widgetIcon: workspace.widgetIcon ?? "chat",
        widgetUseChannelLogo: workspace.widgetUseChannelLogo ?? false,
        widgetAutoSuggestionsEnabled: workspace.widgetAutoSuggestionsEnabled ?? false,
        widgetQuickReplies: workspace.widgetQuickReplies ?? [],
        translateProductNames: workspace.translateProductNames,
        translateCategoryNames: workspace.translateCategoryNames,
        translateServiceNames: workspace.translateServiceNames,
        catalogBaseLanguage: workspace.catalogBaseLanguage,
      }

      return res.status(201).json(serializedWorkspace)
    } catch (error) {
      logger.error("❌ Error creating workspace:", {
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
        `📦 Workspace data received: ${JSON.stringify(
          {
            ...workspaceData,
            whatsappAppSecret: workspaceData.whatsappAppSecret ? "****" : undefined,
          },
          null,
          2
        )}`
      )

      // 🔍 LOG SPECIFICO per whatsappProvider (UltraMsg)
      logger.info("=== WHATSAPP PROVIDER DEBUG ===")
      logger.info("whatsappProvider:", workspaceData.whatsappProvider || "NOT SET")
      logger.info("ultraMsgInstanceId:", workspaceData.ultraMsgInstanceId || "NOT SET")
      logger.info("ultraMsgToken:", workspaceData.ultraMsgToken ? "***SET***" : "NOT SET")
      logger.info("ultraMsgApiUrl:", workspaceData.ultraMsgApiUrl || "NOT SET")

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

      // 🐞 DEBUG: Log what service returned
      logger.info("=== SERVICE RESPONSE DEBUG ===")
      logger.info("whatsappProvider returned:", workspace?.whatsappProvider || "NOT IN RESPONSE")
      logger.info("ultraMsgInstanceId returned:", workspace?.ultraMsgInstanceId || "NOT IN RESPONSE")
      logger.info("ultraMsgToken returned:", workspace?.ultraMsgToken ? "***SET***" : "NOT IN RESPONSE")
      logger.info("ultraMsgApiUrl returned:", workspace?.ultraMsgApiUrl || "NOT IN RESPONSE")

      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" })
      }

      // 🔧 FIX: Load webhookId from WhatsappSettings table after update
      const whatsappSettings = await prisma.whatsappSettings.findUnique({
        where: { workspaceId: workspace.id },
        select: { webhookId: true }
      })

      // Serialize workspace to plain object with all properties (same as getWorkspaceById)
      const serializedWorkspace = {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        whatsappPhoneNumber: workspace.whatsappPhoneNumber,
        whatsappApiKey: workspace.whatsappApiKey,
        whatsappAppName: workspace.whatsappAppName ?? null,
        whatsappAppSecret: workspace.whatsappAppSecret ?? null,
        whatsappPhoneNumberId: workspace.whatsappPhoneNumberId,
        whatsappVerifyToken: workspace.whatsappVerifyToken,
        webhookUrl: workspace.webhookUrl,
        whatsappBusinessAccountId: workspace.whatsappBusinessAccountId ?? null,
        whatsappProvider: workspace.whatsappProvider ?? "meta",
        ultraMsgInstanceId: workspace.ultraMsgInstanceId ?? null,
        ultraMsgToken: workspace.ultraMsgToken ?? null,
        ultraMsgApiUrl: workspace.ultraMsgApiUrl ?? null,
        // 🔧 FIX: Use REAL webhookId from WhatsappSettings, NOT workspace.id
        whatsappWebhookId: whatsappSettings?.webhookId ?? null,
        notificationEmail: workspace.notificationEmail,
        adminEmail: workspace.adminEmail,
        language: workspace.language,
        defaultLanguage: workspace.defaultLanguage ?? "it", // 🌍 ISO-2 default language for customers
        currency: workspace.currency,
        messageLimit: workspace.messageLimit,
        blocklist: workspace.blocklist,
        welcomeMessage: workspace.welcomeMessage,
        wipMessage: workspace.wipMessage,
        channelStatus: workspace.channelStatus,

        url: workspace.url,
        debugMode: workspace.debugMode,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        allowedExternalLinks: workspace.allowedExternalLinks,
        // 🆕 Channel Configuration (Feature 199 + Andrea's wizard)
        channelType: workspace.channelType,
        enableWhatsapp: workspace.enableWhatsapp,
        enableWidget: workspace.enableWidget,
        sellsProductsAndServices: workspace.sellsProductsAndServices,
        hasSalesAgents: workspace.hasSalesAgents,
        hasHumanSupport: workspace.hasHumanSupport,
        humanSupportInstructions: workspace.humanSupportInstructions,
        frustrationEscalationInstructions: workspace.frustrationEscalationInstructions, // 🆕 Feature 203
        operatorContactMethod: workspace.operatorContactMethod,
        operatorEmail: workspace.operatorEmail,
        operatorWhatsappNumber: workspace.operatorWhatsappNumber,
        toneOfVoice: workspace.toneOfVoice,
        botIdentityResponse: workspace.botIdentityResponse,
        address: workspace.address,
        customAiRules: workspace.customAiRules,
        registrationPage: workspace.registrationPage ?? null,
        requireManualApproval: workspace.requireManualApproval ?? false,
        logoUrl: workspace.logoUrl,
        // 🆕 Chatbot Personalization
        chatbotName: workspace.chatbotName,
        businessType: workspace.businessType,
        // 🆕 Widget Settings
        widgetLogoUrl: workspace.widgetLogoUrl ?? null,
        widgetLogoKey: workspace.widgetLogoKey ?? null,
        widgetTitle: workspace.widgetTitle ?? null,
        widgetLanguage: workspace.widgetLanguage ?? "it",
        widgetPrimaryColor: workspace.widgetPrimaryColor ?? "#22c55e",
        widgetIcon: workspace.widgetIcon ?? "chat",
        widgetUseChannelLogo: workspace.widgetUseChannelLogo ?? false,
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
      if (
        (error as any).message === "FREE_PLAN_CHANNEL_LIMIT" ||
        (error as any).message === "CHANNEL_LIMIT_EXCEEDED" ||
        (error as any).code === "CHANNEL_LIMIT_EXCEEDED"
      ) {
        return res.status((error as any).statusCode || 403).json({
          error: "Plan limit reached",
          code: "CHANNEL_LIMIT_EXCEEDED",
          message: "Your current plan allows only one active channel. Upgrade your plan to add more.",
        })
      }
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
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

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
                createdAt: { gte: since },
                deletedAt: null,
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

  /**
   * Update WhatsApp provider configuration
   * POST /api/v1/workspaces/:id/whatsapp-config
   */
  updateWhatsAppConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const {
        whatsappProvider,
        metaPhoneNumberId,
        metaAccessToken,
        webhookVerifyToken,
        ultraMsgInstanceId,
        ultraMsgToken,
        ultraMsgApiUrl,
      } = req.body

      logger.info(`[WhatsApp Config] Updating configuration for workspace ${id}`, {
        provider: whatsappProvider,
        hasMetaPhoneNumberId: !!metaPhoneNumberId,
        hasMetaAccessToken: !!metaAccessToken,
        hasWebhookVerifyToken: !!webhookVerifyToken,
        hasUltraMsgInstanceId: !!ultraMsgInstanceId,
        hasUltraMsgToken: !!ultraMsgToken,
        hasUltraMsgApiUrl: !!ultraMsgApiUrl,
      })

      // Validate provider
      if (!whatsappProvider || !['meta', 'ultramsg'].includes(whatsappProvider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid provider. Must be "meta" or "ultramsg"',
        })
      }

      // Validate Meta configuration
      if (whatsappProvider === 'meta') {
        if (!metaPhoneNumberId || !metaAccessToken) {
          return res.status(400).json({
            success: false,
            message: 'Meta provider requires metaPhoneNumberId and metaAccessToken',
          })
        }
      }

      // Validate UltraMsg configuration
      if (whatsappProvider === 'ultramsg') {
        if (!ultraMsgInstanceId || !ultraMsgToken) {
          return res.status(400).json({
            success: false,
            message: 'UltraMsg provider requires ultraMsgInstanceId and ultraMsgToken',
          })
        }
      }

      // Update workspace with new configuration
      const workspace = await this.workspaceService.update(id, {
        whatsappProvider,
        metaPhoneNumberId: whatsappProvider === 'meta' ? metaPhoneNumberId : null,
        metaAccessToken: whatsappProvider === 'meta' ? metaAccessToken : null,
        webhookVerifyToken: whatsappProvider === 'meta' ? webhookVerifyToken : null,
        ultraMsgInstanceId: whatsappProvider === 'ultramsg' ? ultraMsgInstanceId : null,
        ultraMsgToken: whatsappProvider === 'ultramsg' ? ultraMsgToken : null,
        ultraMsgApiUrl: whatsappProvider === 'ultramsg' ? ultraMsgApiUrl : null,
      })

      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        })
      }

      const ws = workspace as any

      logger.info(`[WhatsApp Config] ✅ Configuration updated for workspace ${id}`, {
        provider: ws.whatsappProvider,
      })

      // Get webhookId from whatsappSettings
      const settings = await prisma.whatsappSettings.findUnique({
        where: { workspaceId: id },
        select: { webhookId: true }
      })

      const webhookId = settings?.webhookId || id

      return res.json({
        success: true,
        message: 'WhatsApp configuration updated successfully',
        data: {
          whatsappProvider: ws.whatsappProvider,
          ultraMsgApiUrl: ws.ultraMsgApiUrl || '',
          webhookUrl: whatsappProvider === 'meta'
            ? `https://www.echatbot.ai/api/whatsapp/webhook/${webhookId}`
            : `https://www.echatbot.ai/api/whatsapp/ultramsg/${webhookId}`,
        },
      })
    } catch (error) {
      logger.error('[WhatsApp Config] Error updating configuration:', error)
      return next(error)
    }
  }

  /**
   * Get WhatsApp provider configuration
   * GET /api/v1/workspaces/:id/whatsapp-config
   */
  getWhatsAppConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const workspace = await prisma.workspace.findUnique({
        where: { id },
      }) as any

      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        })
      }

      logger.info(`[WhatsApp Config] Retrieved configuration for workspace ${id}`, {
        provider: (workspace as any).whatsappProvider || 'not-configured',
      })

      const ws = workspace as any

      // Get webhookId from whatsappSettings
      const settings = await prisma.whatsappSettings.findUnique({
        where: { workspaceId: id },
        select: { webhookId: true }
      })

      const webhookId = settings?.webhookId || id

      return res.json({
        success: true,
        data: {
          whatsappProvider: ws.whatsappProvider || 'meta',
          metaPhoneNumberId: ws.metaPhoneNumberId || '',
          metaAccessToken: ws.metaAccessToken || '',
          webhookVerifyToken: ws.webhookVerifyToken || '',
          ultraMsgInstanceId: ws.ultraMsgInstanceId || '',
          ultraMsgToken: ws.ultraMsgToken || '',
          ultraMsgApiUrl: ws.ultraMsgApiUrl || '',
          webhookUrl: ws.whatsappProvider === 'ultramsg'
            ? `https://www.echatbot.ai/api/whatsapp/ultramsg/${webhookId}`
            : `https://www.echatbot.ai/api/whatsapp/webhook/${webhookId}`,
        },
      })
    } catch (error) {
      logger.error('[WhatsApp Config] Error fetching configuration:', error)
      return next(error)
    }
  }

  // ─── WasenderAPI Methods ──────────────────────────────────────────────────

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/wasender/initialize:
   *   post:
   *     summary: Initialize WasenderAPI session (QR onboarding)
   *     tags: [Wasender]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - phoneNumber
   *             properties:
   *               phoneNumber:
   *                 type: string
   *                 example: "+393331234567"
   *     responses:
   *       200:
   *         description: Session created, QR string returned
   *       400:
   *         description: Validation error or insufficient credits
   *       401:
   *         description: Unauthorized
   */
  initializeWasenderSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { workspaceId } = req.params
      const userId = (req as any).user?.id
      const { phoneNumber } = req.body

      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required' })
      if (!phoneNumber.startsWith('+')) {
        return res.status(400).json({
          error: 'Phone number must be in E.164 format (e.g., +393331234567)',
        })
      }

      logger.info('[Wasender] Initializing session:', { workspaceId, userId })

      const workspace = await this.workspaceService.initializeWasenderSession(
        workspaceId,
        userId,
        phoneNumber
      )

      return res.status(200).json(workspace)
    } catch (error: any) {
      logger.error('[Wasender] Failed to initialize session:', error)

      if (error.message?.startsWith('WASENDER_PLAN_LIMIT')) {
        return res.status(402).json({
          error: 'Plan limit reached',
          message: 'Your WasenderAPI account has reached the maximum number of sessions. Upgrade your WasenderAPI plan at wasenderapi.com to add more channels.',
          code: 'WASENDER_PLAN_LIMIT',
        })
      }
      if (error.message?.startsWith('WASENDER_AUTH_ERROR')) {
        return res.status(503).json({
          error: 'WasenderAPI authentication failed',
          message: 'Invalid or expired WasenderAPI Personal Access Token. Contact your administrator.',
          code: 'WASENDER_AUTH_ERROR',
        })
      }

      return res.status(400).json({ error: error.message })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/wasender/disconnect:
   *   post:
   *     summary: Disconnect Wasender session (pause)
   *     tags: [Wasender]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *     responses:
   *       200:
   *         description: Session disconnected
   *       400:
   *         description: Error
   *       401:
   *         description: Unauthorized
   */
  disconnectWasenderSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { workspaceId } = req.params
      const userId = (req as any).user?.id

      if (!userId) return res.status(401).json({ error: 'Unauthorized' })

      logger.info('[Wasender] Disconnecting session:', { workspaceId, userId })

      await this.workspaceService.disconnectWasenderSession(workspaceId, userId)

      return res.status(200).json({ success: true, message: 'Session disconnected' })
    } catch (error: any) {
      logger.error('[Wasender] Failed to disconnect session:', error)
      return res.status(400).json({ error: error.message })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/wasender/delete:
   *   post:
   *     summary: Permanently delete Wasender session
   *     tags: [Wasender]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *     responses:
   *       200:
   *         description: Session deleted
   *       400:
   *         description: Error
   *       401:
   *         description: Unauthorized
   */
  deleteWasenderSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { workspaceId } = req.params
      const userId = (req as any).user?.id

      if (!userId) return res.status(401).json({ error: 'Unauthorized' })

      logger.info('[Wasender] Deleting session:', { workspaceId, userId })

      await this.workspaceService.deleteWasenderSession(workspaceId, userId)

      return res.status(200).json({ success: true, message: 'Session deleted' })
    } catch (error: any) {
      logger.error('[Wasender] Failed to delete session:', error)
      return res.status(400).json({ error: error.message })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/wasender/regenerate-qr:
   *   post:
   *     summary: Regenerate Wasender QR code (expired after 45s)
   *     tags: [Wasender]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *     responses:
   *       200:
   *         description: Fresh QR string returned
   *       400:
   *         description: Error
   *       401:
   *         description: Unauthorized
   */
  regenerateWasenderQr = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { workspaceId } = req.params
      const userId = (req as any).user?.id

      if (!userId) return res.status(401).json({ error: 'Unauthorized' })

      logger.info('[Wasender] Regenerating QR:', { workspaceId, userId })

      const qrString = await this.workspaceService.regenerateWasenderQr(workspaceId, userId)

      return res.status(200).json({ qrString })
    } catch (error: any) {
      logger.error('[Wasender] Failed to regenerate QR:', error)
      return res.status(400).json({ error: error.message })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/wasender/restart:
   *   post:
   *     summary: Restart Wasender session (no re-scan needed if phone is still linked)
   *     tags: [Wasender]
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
   *         description: Session restarted
   *       400:
   *         description: Error
   *       401:
   *         description: Unauthorized
   */
  restartWasenderSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { workspaceId } = req.params
      const userId = (req as any).user?.id

      if (!userId) return res.status(401).json({ error: 'Unauthorized' })

      logger.info('[Wasender] Restarting session:', { workspaceId, userId })

      await this.workspaceService.restartWasenderSession(workspaceId, userId)

      return res.status(200).json({ success: true })
    } catch (error: any) {
      logger.error('[Wasender] Failed to restart session:', error)
      return res.status(400).json({ error: error.message })
    }
  }
}

