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
      whatsappPhoneNumber: data.whatsappPhoneNumber,
      whatsappApiKey: data.whatsappApiKey, // ✅ FIX: Use whatsappApiKey (new field name)
      whatsappApiToken: data.whatsappApiKey, // ✅ LEGACY: Keep for backward compatibility
      whatsappWebhookUrl: data.whatsappWebhookUrl,
      webhookUrl: data.webhookUrl,
      notificationEmail: data.notificationEmail,
      language: data.language,
      currency: data.currency,
      messageLimit: data.messageLimit,
      blocklist: data.blocklist,
      welcomeMessage: data.welcomeMessage,
      wipMessage: data.wipMessage,
      channelStatus: data.channelStatus,
      isActive: data.isActive,
      isDelete: data.isDelete,
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
      sellsProductsAndServices: data.sellsProductsAndServices ?? true,
      hasSalesAgents: data.hasSalesAgents ?? false,
      hasHumanSupport: data.hasHumanSupport ?? true,
      humanSupportInstructions: data.humanSupportInstructions || null,
      operatorContactMethod: data.operatorContactMethod || 'email',
      operatorWhatsappNumber: data.operatorWhatsappNumber || null,
      toneOfVoice: data.toneOfVoice || 'friendly',
      botIdentityResponse: data.botIdentityResponse || null,
      address: data.address || null,
      customAiRules: data.customAiRules || null,
      // 🆕 Logo
      logoUrl: data.logoUrl || null,
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
      whatsappWebhookUrl: workspace.whatsappWebhookUrl,
      webhookUrl: workspace.webhookUrl,
      notificationEmail: workspace.notificationEmail,
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
      allowedExternalLinks: workspace.allowedExternalLinks || [],
      // 🆕 Channel Configuration (Feature 199)
      sellsProductsAndServices: workspace.sellsProductsAndServices,
      hasSalesAgents: workspace.hasSalesAgents,
      hasHumanSupport: workspace.hasHumanSupport,
      humanSupportInstructions: workspace.humanSupportInstructions,
      operatorContactMethod: workspace.operatorContactMethod,
      operatorWhatsappNumber: workspace.operatorWhatsappNumber,
      toneOfVoice: workspace.toneOfVoice,
      botIdentityResponse: workspace.botIdentityResponse,
      address: workspace.address,
      customAiRules: workspace.customAiRules,
      // 🆕 Logo
      logoUrl: workspace.logoUrl,
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
          isDelete: false,
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
        if (workspace.isDelete) {
          logger.debug(
            `Returning simplified version of deleted workspace ${id}`
          )
          return Workspace.create({
            id: workspace.id,
            name: workspace.name || "Deleted Workspace", // Ensure name is never empty
            slug: workspace.slug || "deleted-workspace",
            isDelete: true,
            isActive: false,
            language: "ENG",
            createdAt: workspace.createdAt || new Date(),
            updatedAt: workspace.updatedAt || new Date(),
            currency: "EUR",
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
          isDelete: false,
          isActive: true,
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
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          workspaces: {
            include: {
              workspace: true,
            },
            orderBy: {
              workspace: {
                createdAt: 'asc',
              },
            },
          },
        },
      })

      if (!user || !user.workspaces) {
        logger.debug(`No workspaces found for user ${userId}`)
        return []
      }

      // Filter only non-deleted workspaces
      const workspaces = user.workspaces
        .map((uw) => uw.workspace)
        .filter((workspace) => !workspace.isDelete)

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
      `📥 Raw data received in repository.update: ${JSON.stringify(data, null, 2)}`
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
            isActive: existingWorkspace.isActive,
            debugMode: existingWorkspace.debugMode,
          },
          null,
          2
        )}`
      )

      // Ensure whatsappApiToken/whatsappApiKey is mapped correctly for Prisma
      const dbData: any = { ...data }

      // 🔄 Map challengeStatus → channelStatus (frontend uses different name than DB)
      if (dbData.challengeStatus !== undefined) {
        dbData.channelStatus = dbData.challengeStatus
        delete dbData.challengeStatus
      }

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

      // Handle adminEmail - should be saved in whatsappSettings, not workspace
      let adminEmail: string | undefined
      if (dbData.adminEmail !== undefined) {
        adminEmail = dbData.adminEmail
        delete dbData.adminEmail
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

      logger.debug(
        `📝 Data prepared for Prisma update (workspace ${id}): ${JSON.stringify(dbData, null, 2)}`
      )
      logger.debug(`📧 AdminEmail to update: ${adminEmail}`)
      
      // 🔍 LOG FEATURE 199 AFTER TRANSFORMATION
      logger.debug("=== FEATURE 199 AFTER TRANSFORMATION ===")
      logger.debug(`sellsProductsAndServices in dbData: ${dbData.sellsProductsAndServices}`)
      logger.debug(`hasSalesAgents in dbData: ${dbData.hasSalesAgents}`)
      logger.debug(`hasHumanSupport in dbData: ${dbData.hasHumanSupport}`)

      // Prepare the exact data object for Prisma
      const prismaUpdateData: any = {
        ...dbData,
        // Update whatsappSettings if adminEmail is provided
        ...(adminEmail !== undefined && {
          whatsappSettings: {
            upsert: {
              create: {
                phoneNumber:
                  data.whatsappPhoneNumber ||
                  dbData.whatsappPhoneNumber ||
                  "placeholder",
                apiKey:
                  dbData.whatsappApiKey ||
                  data.whatsappApiToken ||
                  "placeholder",
                adminEmail: adminEmail,
              },
              update: {
                phoneNumber:
                  data.whatsappPhoneNumber || dbData.whatsappPhoneNumber,
                apiKey: dbData.whatsappApiKey || data.whatsappApiToken,
                adminEmail: adminEmail,
              },
            },
          },
        }),
      }

      logger.debug(
        `🔧 EXACT Prisma update data: ${JSON.stringify(prismaUpdateData, null, 2)}`
      )
      logger.info(`🚀 Calling Prisma.workspace.update with ID: ${id}`)

      const updatedWorkspace = await this.prisma.workspace.update({
        where: { id },
        data: prismaUpdateData,
        include: {
          whatsappSettings: true,
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
            isActive: updatedWorkspace.isActive,
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
        if (updatedWorkspace.isDelete) {
          logger.debug(
            `Returning simplified version of deleted workspace ${id}`
          )
          return Workspace.create({
            id: updatedWorkspace.id,
            name: updatedWorkspace.name || "Deleted Workspace", // Ensure name is never empty
            slug: updatedWorkspace.slug || "deleted-workspace",
            isDelete: true,
            isActive: false,
            language: "ENG",
            createdAt: updatedWorkspace.createdAt || new Date(),
            updatedAt: updatedWorkspace.updatedAt || new Date(),
            currency: "EUR",
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

      // Soft-delete: set deletedAt and isDelete flag
      await this.prisma.workspace.update({
        where: { id },
        data: {
          isDelete: true,  // Legacy flag for backward compatibility
          deletedAt: new Date(),  // New soft-delete timestamp
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
