import { prisma, PrismaClient } from "@echatbot/database"
import { Workspace, WorkspaceProps } from "../domain/entities/workspace.entity"
import { WorkspaceRepositoryInterface } from "../domain/repositories/workspace.repository.interface"
import logger from "../utils/logger"

export class WorkspaceRepository implements WorkspaceRepositoryInterface {
  private prisma: PrismaClient

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || (prisma as unknown as PrismaClient)
  }

  /**
   * Map database model to domain entity
   */
  private mapToDomain(data: any): Workspace {
    return Workspace.create({
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      whatsappPhoneNumber:
        data.whatsappSettings?.phoneNumber ?? data.whatsappPhoneNumber,
      whatsappApiKey:
        data.whatsappSettings?.apiKey ?? data.whatsappApiKey, // ✅ FIX: Use whatsappApiKey (new field name)
      whatsappApiToken:
        data.whatsappSettings?.apiKey ?? data.whatsappApiKey, // ✅ LEGACY: Keep for backward compatibility
      whatsappAppName: data.whatsappSettings?.appName ?? null,
      whatsappPhoneNumberId: data.whatsappPhoneNumberId ?? null,
      whatsappVerifyToken:
        data.whatsappSettings?.webhookToken ?? data.whatsappVerifyToken ?? null,
      whatsappAppSecret: data.whatsappSettings?.appSecret ?? null,
      whatsappWebhookToken: data.whatsappSettings?.webhookToken ?? null,
      whatsappWebhookUrl:
        data.whatsappSettings?.webhookUrl ??
        data.whatsappWebhookUrl ??
        data.webhookUrl,
      whatsappBusinessAccountId: data.whatsappSettings?.businessAccountId ?? null,
      // 🆕 Multi-Provider WhatsApp Support
      whatsappProvider:
        data.whatsappProvider ??
        (data.ultraMsgInstanceId || data.ultraMsgToken ? "ultramsg" : "meta"),
      metaPhoneNumberId: data.metaPhoneNumberId ?? data.whatsappPhoneNumberId ?? null,
      metaAccessToken: data.metaAccessToken ?? data.whatsappApiKey ?? null,
      webhookVerifyToken: data.webhookVerifyToken ?? data.whatsappVerifyToken ?? null,
      ultraMsgInstanceId: data.ultraMsgInstanceId ?? null,
      ultraMsgToken: data.ultraMsgToken ?? null,
      ultraMsgApiUrl: data.ultraMsgApiUrl ?? null,
      webhookUrl: data.webhookUrl,
      notificationEmail: data.notificationEmail,
      language: data.language,
      currency: data.currency,
      messageLimit: data.messageLimit,
      blocklist: data.blocklist,
      welcomeMessage: data.welcomeMessage,
      wipMessage: data.wipMessage,
      channelStatus: data.channelStatus,
      deletedAt: data.deletedAt ?? null,
      url: data.url,
      adminEmail: data.whatsappSettings?.adminEmail || null,
      debugMode: data.debugMode ?? true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      afterRegistrationMessages: data.afterRegistrationMessages,
      planType: data.planType || null,
      trialEndsAt: data.trialEndsAt || null,
      allowedExternalLinks: data.allowedExternalLinks || [],
      // 🆕 Channel Configuration (Feature 199)
      channelType: data.channelType ?? "WHATSAPP",
      enableWhatsapp: data.enableWhatsapp ?? true,
      enableWidget: data.enableWidget ?? false,
      sellsProductsAndServices: data.sellsProductsAndServices ?? true,
      hasSalesAgents: data.hasSalesAgents ?? false,
      hasHumanSupport: data.hasHumanSupport ?? true,
      humanSupportInstructions: data.humanSupportInstructions || null,
      frustrationEscalationInstructions: data.frustrationEscalationInstructions || null,
      operatorContactMethod: data.operatorContactMethod || 'email',
      operatorEmail: data.operatorEmail || null,
      operatorWhatsappNumber: data.operatorWhatsappNumber || null,
      toneOfVoice: data.toneOfVoice || 'friendly',
      botIdentityResponse: data.botIdentityResponse || null,
      address: data.address || null,
      customAiRules: data.customAiRules || null,
      registrationPage: data.registrationPage || null,
      requireManualApproval: data.requireManualApproval ?? false,
      chatbotName: data.chatbotName || null,
      businessType: data.businessType || null,
      // 🆕 Logo
      logoUrl: data.logoUrl || null,
      // 🆕 Widget Settings
      widgetLogoUrl: data.widgetLogoUrl ?? null,
      widgetLogoKey: data.widgetLogoKey ?? null,
      widgetTitle: data.widgetTitle ?? null,
      widgetLanguage: data.widgetLanguage ?? "it",
      widgetPrimaryColor: data.widgetPrimaryColor ?? "#22c55e",
      widgetIcon: data.widgetIcon ?? "chat",
      widgetUseChannelLogo: data.widgetUseChannelLogo ?? false,
      widgetAutoSuggestionsEnabled: data.widgetAutoSuggestionsEnabled ?? false,
      widgetQuickReplies: data.widgetQuickReplies ?? [],
      // 🆕 Translation Settings
      translateProductNames: data.translateProductNames ?? false,
      translateCategoryNames: data.translateCategoryNames ?? false,
      translateServiceNames: data.translateServiceNames ?? true,
      catalogBaseLanguage: data.catalogBaseLanguage ?? "it",
    })
  }

  /**
   * Map domain entity to database model
   */
  private mapToDatabase(workspace: Workspace): any {
    return {
      id: workspace.id || undefined,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      whatsappPhoneNumber: workspace.whatsappPhoneNumber,
      whatsappApiKey: workspace.whatsappApiKey || workspace.whatsappApiToken, // ✅ FIX: Prefer whatsappApiKey, fallback to whatsappApiToken
      whatsappPhoneNumberId: workspace.whatsappPhoneNumberId,
      whatsappVerifyToken: workspace.whatsappVerifyToken,
      whatsappWebhookUrl: workspace.whatsappWebhookUrl,
      webhookUrl: workspace.webhookUrl,
      // 🆕 Multi-Provider WhatsApp Support
      whatsappProvider: workspace.whatsappProvider,
      metaPhoneNumberId:
        workspace.metaPhoneNumberId ?? workspace.whatsappPhoneNumberId ?? null,
      metaAccessToken: workspace.metaAccessToken ?? workspace.whatsappApiKey ?? null,
      webhookVerifyToken: workspace.webhookVerifyToken ?? workspace.whatsappVerifyToken ?? null,
      ultraMsgInstanceId: workspace.ultraMsgInstanceId,
      ultraMsgToken: workspace.ultraMsgToken,
      ultraMsgApiUrl: workspace.ultraMsgApiUrl,
      notificationEmail: workspace.notificationEmail,
      language: workspace.language,
      currency: workspace.currency,
      messageLimit: workspace.messageLimit,
      blocklist: workspace.blocklist,
      welcomeMessage: workspace.welcomeMessage,
      wipMessage: workspace.wipMessage,
      channelStatus: workspace.channelStatus,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      deletedAt: workspace.deletedAt ?? null,
      url: workspace.url,
      debugMode: workspace.debugMode,
      allowedExternalLinks: workspace.allowedExternalLinks || [],
      // 🆕 Channel Configuration (Feature 199)
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
      registrationPage: workspace.registrationPage,
      requireManualApproval: workspace.requireManualApproval,
      chatbotName: workspace.chatbotName,
      businessType: workspace.businessType,
      // 🆕 Logo
      logoUrl: workspace.logoUrl,
      // 🆕 Widget Settings
      widgetLogoUrl: workspace.widgetLogoUrl,
      widgetLogoKey: workspace.widgetLogoKey,
      widgetTitle: workspace.widgetTitle,
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
  }

  /**
   * Find all active workspaces
   */
  async findAll(): Promise<Workspace[]> {
    logger.debug("Finding all workspaces")

    try {
      const workspaces = await this.prisma.workspace.findMany({
        where: {
          deletedAt: null,
        },
        include: {
          whatsappSettings: true,
        },
        orderBy: { createdAt: "asc" },
      })

      logger.debug(`Found ${workspaces.length} workspaces`)
      
      // 🔍 DEBUG: Log raw sellsProductsAndServices values from Prisma
      workspaces.forEach((ws) => {
        logger.info(`🔍 PRISMA RAW - Workspace "${ws.name}": sellsProductsAndServices = ${ws.sellsProductsAndServices} (type: ${typeof ws.sellsProductsAndServices})`)
      })

      // Map workspaces to domain entities
      const mappedWorkspaces = workspaces.map((workspace) => this.mapToDomain(workspace))
      
      // 🔍 DEBUG: Log mapped sellsProductsAndServices values
      mappedWorkspaces.forEach((ws) => {
        logger.info(`🔍 MAPPED - Workspace "${ws.name}": sellsProductsAndServices = ${ws.sellsProductsAndServices} (type: ${typeof ws.sellsProductsAndServices})`)
      })
      
      return mappedWorkspaces
    } catch (error) {
      logger.error("Error finding workspaces:", error)
      throw error
    }
  }

  /**
   * Find a workspace by ID
   */
  async findById(id: string): Promise<Workspace | null> {
    logger.debug(`Finding workspace by ID: ${id}`)

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id },
        include: {
          whatsappSettings: true,
          agentConfigs: true, // 🔧 FIX: Include agentConfigs for LLM settings
        },
      })

      if (!workspace) {
        logger.debug(`Workspace with ID ${id} not found`)
        return null
      }

      logger.debug(`Found workspace with ID ${id}`)

      try {
        const domainWorkspace = this.mapToDomain(workspace)
        // 🔧 FIX: Add agentConfigs to the domain object (temporary fix)
        ;(domainWorkspace as any).agentConfigs = workspace.agentConfigs || []
        return domainWorkspace
      } catch (error) {
        // If mapping fails but it's a deleted workspace, return a simplified version
        // This preserves compatibility with the test that expects to find deleted workspaces
        if (workspace.deletedAt) {
          logger.debug(
            `Returning simplified version of deleted workspace ${id}`
          )
          return Workspace.create({
            id: workspace.id,
            name: workspace.name || "Deleted Workspace", // Ensure name is never empty
            slug: workspace.slug || "deleted-workspace",
            deletedAt: workspace.deletedAt ?? new Date(),
            language: "ENG",
            createdAt: workspace.createdAt || new Date(),
            updatedAt: workspace.updatedAt || new Date(),
            currency: "USD",
            channelStatus: false,
            description: null,
            messageLimit: 50,
            blocklist: "",
            url: null,
            welcomeMessage: null,
            wipMessage: null,
            afterRegistrationMessages: null,
            debugMode: true,
            adminEmail: null,
            whatsappPhoneNumber: null,
            whatsappApiKey: null,
            whatsappApiToken: null,
            whatsappWebhookUrl: null,
            notificationEmail: null,
            webhookUrl: null,
          })
        } else {
          throw error
        }
      }
    } catch (error) {
      logger.error(`Error finding workspace with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find a workspace by slug
   */
  async findBySlug(slug: string): Promise<Workspace | null> {
    logger.debug(`Finding workspace by slug: ${slug}`)

    try {
      const workspace = await this.prisma.workspace.findFirst({
        where: { slug },
      })

      if (!workspace) {
        logger.debug(`Workspace with slug ${slug} not found`)
        return null
      }

      logger.debug(`Found workspace with slug ${slug}`)
      return this.mapToDomain(workspace)
    } catch (error) {
      logger.error(`Error finding workspace with slug ${slug}:`, error)
      throw error
    }
  }

  /**
   * Find a workspace by WhatsApp phone number (channel number)
   * This allows the backend to determine workspace from the incoming message's channel
   */
  async findByWhatsAppPhoneNumber(
    phoneNumber: string
  ): Promise<Workspace | null> {
    if (!phoneNumber) {
      logger.debug("findByWhatsAppPhoneNumber: Empty phone number provided")
      return null
    }

    // Normalize phone number (remove spaces, ensure format)
    const normalizedPhone = phoneNumber.trim()

    logger.debug(
      `🔍 Finding workspace by WhatsApp phone number: ${normalizedPhone}`
    )

    try {
      const workspace = await this.prisma.workspace.findFirst({
        where: {
          whatsappPhoneNumber: normalizedPhone,
          deletedAt: null,
          channelStatus: true,
        },
        include: {
          whatsappSettings: true,
          agentConfigs: true,
        },
      })

      if (!workspace) {
        logger.debug(
          `⚠️ No active workspace found for WhatsApp phone: ${normalizedPhone}`
        )
        return null
      }

      logger.debug(
        `✅ Found workspace: ${workspace.name} (${workspace.id}) for phone: ${normalizedPhone}`
      )
      const domainWorkspace = this.mapToDomain(workspace)
      ;(domainWorkspace as any).agentConfigs = workspace.agentConfigs || []
      return domainWorkspace
    } catch (error) {
      logger.error(
        `Error finding workspace by WhatsApp phone ${normalizedPhone}:`,
        error
      )
      throw error
    }
  }

  /**
   * Find workspaces by user ID
   */
  async findByUserId(userId: string): Promise<Workspace[]> {
    logger.debug(`Finding workspaces for user ${userId}`)

    try {
      const workspaces = await this.prisma.workspace.findMany({
        where: {
          deletedAt: null,
          OR: [
            { ownerId: userId },
            {
              users: {
                some: {
                  userId: userId,
                },
              },
            },
          ],
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          whatsappSettings: true,
        },
      })

      logger.debug(`Found ${workspaces.length} workspaces for user ${userId}`)
      
      // 🔍 DEBUG: Log raw sellsProductsAndServices values from Prisma (findByUserId)
      workspaces.forEach((ws) => {
        logger.info(`🔍 PRISMA RAW (findByUserId) - Workspace "${ws.name}": sellsProductsAndServices = ${ws.sellsProductsAndServices} (type: ${typeof ws.sellsProductsAndServices})`)
      })

      const mappedWorkspaces = workspaces.map((workspace) => this.mapToDomain(workspace))
      
      // 🔍 DEBUG: Log mapped sellsProductsAndServices values (findByUserId)
      mappedWorkspaces.forEach((ws) => {
        logger.info(`🔍 MAPPED (findByUserId) - Workspace "${ws.name}": sellsProductsAndServices = ${ws.sellsProductsAndServices} (type: ${typeof ws.sellsProductsAndServices})`)
      })
      
      return mappedWorkspaces
    } catch (error) {
      logger.error(`Error finding workspaces for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Create a new workspace
   */
  async create(workspace: Workspace): Promise<Workspace> {
    logger.debug(`Creating new workspace: ${workspace.name}`)

    try {
      const data = this.mapToDatabase(workspace)

      const createdWorkspace = await this.prisma.workspace.create({
        data,
      })

      logger.debug(`Created workspace with ID ${createdWorkspace.id}`)
      return this.mapToDomain(createdWorkspace)
    } catch (error) {
      logger.error("Error creating workspace:", error)
      throw error
    }
  }

  /**
   * Update an existing workspace
   */
  async update(
    id: string,
    data: Partial<WorkspaceProps>
  ): Promise<Workspace | null> {
    logger.debug(`Updating workspace with ID ${id}`)
    logger.debug(
      `📥 Raw data received in repository.update: ${JSON.stringify(
        {
          ...data,
          whatsappAppSecret:
            (data as any).whatsappAppSecret ? "****" : undefined,
        },
        null,
        2
      )}`
    )
    
    // 🔍 LOG FEATURE 199
    logger.debug("=== FEATURE 199 REPOSITORY DEBUG ===")
    logger.debug(`sellsProductsAndServices ricevuto: ${data.sellsProductsAndServices} (tipo: ${typeof data.sellsProductsAndServices})`)
    logger.debug(`hasSalesAgents ricevuto: ${data.hasSalesAgents} (tipo: ${typeof data.hasSalesAgents})`)
    logger.debug(`hasHumanSupport ricevuto: ${data.hasHumanSupport} (tipo: ${typeof data.hasHumanSupport})`)

    try {
      const existingWorkspace = await this.prisma.workspace.findUnique({
        where: { id },
        include: { whatsappSettings: true },
      })

      if (!existingWorkspace) {
        logger.debug(`Workspace with ID ${id} not found for update`)
        return null
      }

      logger.debug(
        `💾 BEFORE UPDATE - Current DB state: ${JSON.stringify(
          {
            name: existingWorkspace.name,
            whatsappPhoneNumber: existingWorkspace.whatsappPhoneNumber,
            whatsappApiKey: existingWorkspace.whatsappApiKey,
            adminEmail: existingWorkspace.whatsappSettings?.adminEmail,
            channelStatus: existingWorkspace.channelStatus,
            debugMode: existingWorkspace.debugMode,
          },
          null,
          2
        )}`
      )

      // Ensure whatsappApiToken/whatsappApiKey is mapped correctly for Prisma
      const dbData: any = { ...data }

      // Remove 'id' if present - shouldn't update primary key
      if (dbData.id !== undefined) {
        delete dbData.id
      }

      // Handle both whatsappApiToken (old) and whatsappApiKey (new) fields
      if (dbData.whatsappApiToken !== undefined) {
        dbData.whatsappApiKey = dbData.whatsappApiToken
        delete dbData.whatsappApiToken
      }
      // If whatsappApiKey is sent directly, keep it as is (no transformation needed)
      // Prisma schema uses whatsappApiKey field

      const normalizeWhatsAppField = (value?: string | null): string | undefined => {
        if (value === undefined || value === null) return undefined
        const trimmed = String(value).trim()
        return trimmed.length > 0 ? trimmed : undefined
      }

      // Handle adminEmail - should be saved in whatsappSettings, not workspace
      let adminEmail: string | undefined
      if (dbData.adminEmail !== undefined) {
        adminEmail = dbData.adminEmail
        delete dbData.adminEmail
      }

      let whatsappAppName: string | undefined
      if (dbData.whatsappAppName !== undefined) {
        whatsappAppName = normalizeWhatsAppField(dbData.whatsappAppName)
        delete dbData.whatsappAppName
      }

      // Handle WhatsApp App Secret - stored in whatsappSettings
      let whatsappAppSecret: string | undefined
      if (dbData.whatsappAppSecret !== undefined) {
        whatsappAppSecret = dbData.whatsappAppSecret
        delete dbData.whatsappAppSecret
      }

      // Handle WhatsApp Verify Token - stored in whatsappSettings.webhookToken (keep workspace field too)
      let whatsappVerifyToken: string | undefined
      if (dbData.whatsappVerifyToken !== undefined) {
        const trimmedToken = String(dbData.whatsappVerifyToken).trim()
        whatsappVerifyToken = trimmedToken.length > 0 ? trimmedToken : undefined
      }

      let whatsappBusinessAccountId: string | undefined
      if (dbData.whatsappBusinessAccountId !== undefined) {
        whatsappBusinessAccountId = normalizeWhatsAppField(dbData.whatsappBusinessAccountId)
        delete dbData.whatsappBusinessAccountId
      }

      const normalizeOptional = (value?: string | null): string | undefined => {
        if (value === undefined || value === null) return undefined
        const trimmed = String(value).trim()
        return trimmed.length > 0 ? trimmed : undefined
      }

      // Map Meta provider fields (fallback from legacy WhatsApp fields)
      if (dbData.metaPhoneNumberId === undefined && dbData.whatsappPhoneNumberId !== undefined) {
        dbData.metaPhoneNumberId = normalizeOptional(dbData.whatsappPhoneNumberId)
      }
      if (dbData.metaAccessToken === undefined && dbData.whatsappApiKey !== undefined) {
        dbData.metaAccessToken = normalizeOptional(dbData.whatsappApiKey)
      }
      if (dbData.webhookVerifyToken === undefined && dbData.whatsappVerifyToken !== undefined) {
        dbData.webhookVerifyToken = normalizeOptional(dbData.whatsappVerifyToken)
      }

      // Normalize UltraMsg credentials if present
      if (dbData.ultraMsgInstanceId !== undefined) {
        dbData.ultraMsgInstanceId = normalizeOptional(dbData.ultraMsgInstanceId) ?? null
      }
      if (dbData.ultraMsgToken !== undefined) {
        dbData.ultraMsgToken = normalizeOptional(dbData.ultraMsgToken) ?? null
      }
      if (dbData.ultraMsgApiUrl !== undefined) {
        dbData.ultraMsgApiUrl = normalizeOptional(dbData.ultraMsgApiUrl) ?? null
      }

      const incomingPhoneNumber = normalizeWhatsAppField(
        dbData.whatsappPhoneNumber ?? data.whatsappPhoneNumber
      )
      const incomingApiKey = normalizeWhatsAppField(
        dbData.whatsappApiKey ?? data.whatsappApiToken
      )
      const existingPhoneNumber = normalizeWhatsAppField(
        existingWorkspace.whatsappSettings?.phoneNumber || existingWorkspace.whatsappPhoneNumber
      )
      const existingApiKey = normalizeWhatsAppField(
        existingWorkspace.whatsappSettings?.apiKey || existingWorkspace.whatsappApiKey
      )
      const resolvedPhoneNumber = incomingPhoneNumber ?? existingPhoneNumber
      const resolvedApiKey = incomingApiKey ?? existingApiKey

      // 🔥 REMOVE DEPRECATED FIELDS: whatsappWebhookId and whatsappWebhookToken
      // These fields only exist in WhatsappSettings, NOT in Workspace model
      if (dbData.whatsappWebhookId !== undefined) {
        delete dbData.whatsappWebhookId
      }
      if (dbData.whatsappWebhookToken !== undefined) {
        delete dbData.whatsappWebhookToken
      }

      // Handle JSON fields - ensure they are properly formatted
      if (
        dbData.welcomeMessage &&
        typeof dbData.welcomeMessage === "object"
      ) {
        dbData.welcomeMessage = dbData.welcomeMessage
      }
      if (dbData.wipMessage && typeof dbData.wipMessage === "object") {
        dbData.wipMessage = dbData.wipMessage
      }
      if (dbData.allowedExternalLinks !== undefined) {
        if (Array.isArray(dbData.allowedExternalLinks)) {
          dbData.allowedExternalLinks = dbData.allowedExternalLinks
            .map((link: string) => String(link).trim())
            .filter((link: string) => link.length > 0)
        } else if (typeof dbData.allowedExternalLinks === "string") {
          const trimmed = dbData.allowedExternalLinks.trim()
          dbData.allowedExternalLinks = trimmed
            ? trimmed
                .split(/[\n,]+/)
                .map((link: string) => link.trim())
                .filter((link: string) => link.length > 0)
            : []
        } else {
          dbData.allowedExternalLinks = []
        }
      }

      logger.debug(
        `📝 Data prepared for Prisma update (workspace ${id}): ${JSON.stringify(
          {
            ...dbData,
            whatsappAppSecret: whatsappAppSecret ? "****" : undefined,
            whatsappVerifyToken: whatsappVerifyToken ? "****" : undefined,
          },
          null,
          2
        )}`
      )
      logger.debug(`📧 AdminEmail to update: ${adminEmail}`)
      
      // 🔍 LOG FEATURE 199 AFTER TRANSFORMATION
      logger.debug("=== FEATURE 199 AFTER TRANSFORMATION ===")
      logger.debug(`sellsProductsAndServices in dbData: ${dbData.sellsProductsAndServices}`)
      logger.debug(`hasSalesAgents in dbData: ${dbData.hasSalesAgents}`)
      logger.debug(`hasHumanSupport in dbData: ${dbData.hasHumanSupport}`)

      // Prepare the exact data object for Prisma
      const shouldUpsertWhatsAppSettings =
        adminEmail !== undefined ||
        whatsappAppName !== undefined ||
        whatsappAppSecret !== undefined ||
        whatsappVerifyToken !== undefined ||
        incomingPhoneNumber !== undefined ||
        incomingApiKey !== undefined ||
        whatsappBusinessAccountId !== undefined

      const prismaUpdateData: any = {
        ...dbData,
        // Update whatsappSettings if adminEmail or appSecret is provided
        ...(shouldUpsertWhatsAppSettings && {
          whatsappSettings: {
            upsert: {
              create: {
                phoneNumber: resolvedPhoneNumber || "placeholder",
                apiKey: resolvedApiKey || "placeholder",
                webhookId: crypto.randomUUID(), // Generate unique webhook ID
                webhookToken:
                  whatsappVerifyToken || crypto.randomUUID(), // Generate or use provided token
                ...(adminEmail !== undefined ? { adminEmail } : {}),
                ...(whatsappAppName !== undefined ? { appName: whatsappAppName } : {}),
                ...(whatsappAppSecret !== undefined
                  ? { appSecret: whatsappAppSecret }
                  : {}),
                ...(whatsappBusinessAccountId !== undefined
                  ? { businessAccountId: whatsappBusinessAccountId }
                  : {}),
              },
              update: {
                ...(resolvedPhoneNumber !== undefined
                  ? { phoneNumber: resolvedPhoneNumber }
                  : {}),
                ...(resolvedApiKey !== undefined ? { apiKey: resolvedApiKey } : {}),
                ...(adminEmail !== undefined ? { adminEmail } : {}),
                ...(whatsappAppName !== undefined ? { appName: whatsappAppName } : {}),
                ...(whatsappAppSecret !== undefined
                  ? { appSecret: whatsappAppSecret }
                  : {}),
                ...(whatsappVerifyToken !== undefined
                  ? { webhookToken: whatsappVerifyToken }
                  : {}),
                ...(whatsappBusinessAccountId !== undefined
                  ? { businessAccountId: whatsappBusinessAccountId }
                  : {}),
              },
            },
          },
        }),
      }

      logger.debug(
        `🔧 EXACT Prisma update data: ${JSON.stringify(
          {
            ...prismaUpdateData,
            whatsappSettings: prismaUpdateData.whatsappSettings
              ? {
                  ...prismaUpdateData.whatsappSettings,
                  upsert: {
                    ...prismaUpdateData.whatsappSettings.upsert,
                    create: {
                      ...prismaUpdateData.whatsappSettings.upsert.create,
                      appSecret:
                        prismaUpdateData.whatsappSettings.upsert.create.appSecret
                          ? "****"
                          : undefined,
                      webhookToken:
                        prismaUpdateData.whatsappSettings.upsert.create.webhookToken
                          ? "****"
                          : undefined,
                    },
                    update: {
                      ...prismaUpdateData.whatsappSettings.upsert.update,
                      appSecret:
                        prismaUpdateData.whatsappSettings.upsert.update.appSecret
                          ? "****"
                          : undefined,
                      webhookToken:
                        prismaUpdateData.whatsappSettings.upsert.update.webhookToken
                          ? "****"
                          : undefined,
                    },
                  },
                }
              : undefined,
          },
          null,
          2
        )}`
      )
      logger.info(`🚀 Calling Prisma.workspace.update with ID: ${id}`)

      const updatedWorkspace = await this.prisma.workspace.update({
        where: { id },
        data: prismaUpdateData,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          whatsappPhoneNumber: true,
          whatsappApiKey: true,
          whatsappPhoneNumberId: true,
          whatsappVerifyToken: true,
          webhookUrl: true,
          whatsappProvider: true,
          metaPhoneNumberId: true,
          metaAccessToken: true,
          webhookVerifyToken: true,
          ultraMsgInstanceId: true,
          ultraMsgToken: true,
          ultraMsgApiUrl: true,
          notificationEmail: true,
          language: true,
          currency: true,
          messageLimit: true,
          welcomeMessage: true,
          wipMessage: true,
          afterRegistrationMessages: true,
          channelStatus: true, // ✅ CRITICAL: Include channelStatus
          deletedAt: true,
          url: true,
          debugMode: true,
          apiKey: true,
          metadata: true,
          websiteUrl: true,
          createdAt: true,
          updatedAt: true,
          planType: true,
          trialEndsAt: true,
          allowedExternalLinks: true,
          logoUrl: true,
          logoKey: true,
          widgetLogoUrl: true,
          widgetLogoKey: true,
          widgetTitle: true,
          widgetLanguage: true,
          widgetPrimaryColor: true,
          widgetIcon: true,
          widgetUseChannelLogo: true,
          enableWhatsapp: true,
          enableWidget: true,
          sellsProductsAndServices: true,
          hasSalesAgents: true,
          hasHumanSupport: true,
          humanSupportInstructions: true,
          frustrationEscalationInstructions: true,
          operatorContactMethod: true,
          operatorWhatsappNumber: true,
          toneOfVoice: true,
          botIdentityResponse: true,
          customAiRules: true,
          address: true,
          registrationPage: true,
          requireManualApproval: true,
          chatbotName: true,
          businessType: true,
          translateProductNames: true,
          translateCategoryNames: true,
          translateServiceNames: true,
          catalogBaseLanguage: true,
          ownerId: true,
          creditBalance: true,
          whatsappSettings: {
            select: {
              id: true,
              phoneNumber: true,
              apiKey: true,
              appName: true,
              appSecret: true,
              webhookId: true,
              webhookToken: true,
              businessAccountId: true,
              adminEmail: true,
            },
          },
        },
      })

      logger.debug(`✅ Prisma update completed for workspace ${id}`)
      logger.debug(
        `✅ AFTER UPDATE - New DB state: ${JSON.stringify(
          {
            name: updatedWorkspace.name,
            whatsappPhoneNumber: updatedWorkspace.whatsappPhoneNumber,
            whatsappApiKey: updatedWorkspace.whatsappApiKey,
            adminEmail: updatedWorkspace.whatsappSettings?.adminEmail,
            channelStatus: updatedWorkspace.channelStatus, // ✅ NOW LOGGED
            debugMode: updatedWorkspace.debugMode,
            sellsProductsAndServices: updatedWorkspace.sellsProductsAndServices,
            hasSalesAgents: updatedWorkspace.hasSalesAgents,
            hasHumanSupport: updatedWorkspace.hasHumanSupport,
            updatedAt: updatedWorkspace.updatedAt,
          },
          null,
          2
        )}`
      )
      
      // 🔍 LOG FEATURE 199 FINAL
      logger.debug("=== FEATURE 199 FINAL DB VALUES ===")
      logger.debug(`sellsProductsAndServices DB finale: ${updatedWorkspace.sellsProductsAndServices}`)
      logger.debug(`hasSalesAgents DB finale: ${updatedWorkspace.hasSalesAgents}`)

      logger.debug(`hasHumanSupport DB finale: ${updatedWorkspace.hasHumanSupport}`)

      try {
        const domainEntity = this.mapToDomain(updatedWorkspace)
        logger.debug(
          `🔄 Mapped to domain entity: ${JSON.stringify(domainEntity, null, 2)}`
        )
        return domainEntity
      } catch (error) {
        logger.error(`❌ Error mapping workspace to domain entity:`, error)
        // If mapping fails but it's a deleted workspace, return a simplified version
        if (updatedWorkspace.deletedAt) {
          logger.debug(
            `Returning simplified version of deleted workspace ${id}`
          )
          return Workspace.create({
            id: updatedWorkspace.id,
            name: updatedWorkspace.name || "Deleted Workspace", // Ensure name is never empty
            slug: updatedWorkspace.slug || "deleted-workspace",
            deletedAt: updatedWorkspace.deletedAt ?? new Date(),
            language: "ENG",
            createdAt: updatedWorkspace.createdAt || new Date(),
            updatedAt: updatedWorkspace.updatedAt || new Date(),
            currency: "USD",
            channelStatus: false,
            description: null,
            messageLimit: 50,
            blocklist: "",
            url: null,
            welcomeMessage: null,
            wipMessage: null,
            afterRegistrationMessages: null,
            debugMode: true,
            adminEmail: null,
            whatsappPhoneNumber: null,
            whatsappApiKey: null,
            whatsappApiToken: null,
            whatsappWebhookUrl: null,
            notificationEmail: null,
            webhookUrl: null,
          })
        }
        throw error
      }
    } catch (error) {
      logger.error(`Error updating workspace with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Update agent status (enable/disable) for a workspace
   * Used for Feature 199: Auto-disable e-commerce agents when sellsProductsAndServices = false
   */
  async updateAgentStatus(
    workspaceId: string,
    agentType: string,
    isActive: boolean
  ): Promise<boolean> {
    logger.debug(`Updating agent status for workspace ${workspaceId}: ${agentType} = ${isActive}`)

    try {
      const result = await this.prisma.agentConfig.updateMany({
        where: {
          workspaceId,
          type: agentType as any, // AgentType enum
        },
        data: {
          isActive,
        },
      })

      logger.info(`✅ Updated ${result.count} agent(s) for workspace ${workspaceId}`)
      return result.count > 0
    } catch (error) {
      logger.error(`Error updating agent status:`, error)
      throw error
    }
  }

  /**
   * Soft-delete a workspace (mark as deleted with deletedAt timestamp)
   * Hard-delete happens after 90 days via scheduler
   */
  async delete(id: string): Promise<boolean> {
    logger.debug(`Soft-deleting workspace with ID ${id}`)

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id },
      })

      if (!workspace) {
        logger.debug(`Workspace with ID ${id} not found for deletion`)
        return false
      }

      // Soft-delete: set deletedAt timestamp
      await this.prisma.workspace.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      })

      logger.info(`Soft-deleted workspace ${id} (will be hard-deleted after 90 days)`)
      return true
    } catch (error) {
      logger.error(`Error soft-deleting workspace with ID ${id}:`, error)
      throw error
    }
  }
}
