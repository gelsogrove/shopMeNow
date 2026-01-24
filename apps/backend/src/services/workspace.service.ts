import { prisma } from "@echatbot/database"
import logger from "../utils/logger"

// prisma imported

interface CreateWorkspaceData {
  name: string
  slug?: string
  description?: string
  channelType?: 'WHATSAPP' | 'WIDGET' // 🆕 Channel type (default: WHATSAPP)
  whatsappPhoneNumber?: string // Required for WHATSAPP channels
  whatsappApiKey?: string
  whatsappPhoneNumberId?: string
  whatsappVerifyToken?: string
  currency?: string
  language?: string
  messageLimit?: number
  channelStatus?: boolean
  wipMessage?: string // English only
  blocklist?: string
  url?: string
  welcomeMessage?: string // English only
  // 🆕 Wizard fields (Andrea's simplified wizard)
  sellsProductsAndServices?: boolean
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  humanSupportInstructions?: string
  operatorContactMethod?: string // 'email' | 'whatsapp'
  operatorEmail?: string // 🆕 Email for human support (from user profile)
  operatorWhatsappNumber?: string
  toneOfVoice?: string // 'formal' | 'friendly' | 'professional' | 'casual'
  botIdentityResponse?: string
  faqs?: Array<{ question: string; answer: string }> // FAQs from wizard
  adminEmail?: string // Admin email from user profile
  allowedExternalLinks?: string[] // Security: allowed domains
  createdBy?: string // User ID who created the workspace
}

interface UpdateWorkspaceData {
  name?: string
  slug?: string
  description?: string
  channelType?: 'WHATSAPP' | 'WIDGET' // 🆕 Channel type
  whatsappPhoneNumber?: string
  whatsappApiKey?: string
  whatsappPhoneNumberId?: string
  whatsappVerifyToken?: string
  currency?: string
  language?: string
  messageLimit?: number
  channelStatus?: boolean
  wipMessage?: string // English only
  blocklist?: string
  url?: string
  welcomeMessage?: string // English only
  allowedExternalLinks?: string[] // 🛡️ Security: allowed domains for external links
  logoUrl?: string // Logo URL
  logoKey?: string // 💾 Storage key for cleanup
  debugMode?: boolean // 🐞 Debug mode toggle
  adminEmail?: string // Admin email for WhatsappSettings
  // 🆕 Channel Configuration (Feature 199 + Andrea's wizard)
  enableWhatsapp?: boolean
  enableWidget?: boolean
  sellsProductsAndServices?: boolean
  hasSalesAgents?: boolean
  hasHumanSupport?: boolean
  humanSupportInstructions?: string
  operatorContactMethod?: string
  operatorEmail?: string // 🆕 Email for human support
  operatorWhatsappNumber?: string
  toneOfVoice?: string
  botIdentityResponse?: string
  // 🆕 Widget Configuration
  widgetTitle?: string
  widgetLanguage?: string
  widgetPrimaryColor?: string
  widgetIcon?: string
}

export const workspaceService = {
  async getAll() {
    return prisma.workspace.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        whatsappPhoneNumber: true,
        whatsappApiKey: true,
        whatsappPhoneNumberId: true,
        whatsappVerifyToken: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        currency: true,
        language: true,
        messageLimit: true,
        channelStatus: true,
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        welcomeMessage: true,
        allowedExternalLinks: true, // 🛡️ Security
        // 🆕 Channel Configuration (Feature 199)
        enableWhatsapp: true,
        enableWidget: true,
        sellsProductsAndServices: true,
        hasSalesAgents: true,
        hasHumanSupport: true,
        humanSupportInstructions: true,
        operatorContactMethod: true,
        channelType: true,
        operatorEmail: true,
        operatorWhatsappNumber: true,
        toneOfVoice: true,
        botIdentityResponse: true,
        address: true,
        customAiRules: true,
        // 🆕 Widget Configuration
        widgetTitle: true,
        widgetLanguage: true,
        widgetPrimaryColor: true,
        widgetIcon: true,
        // 🆕 Translation Settings
        translateProductNames: true,
        translateCategoryNames: true,
        translateServiceNames: true,
        catalogBaseLanguage: true,
      },
    })
  },

  async getById(id: string) {
    // 1. Query per il workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        whatsappPhoneNumber: true,
        whatsappApiKey: true,
        whatsappPhoneNumberId: true,
        whatsappVerifyToken: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        currency: true,
        language: true,
        messageLimit: true,
        channelStatus: true,
        debugMode: true, // 🐞 Debug mode toggle
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        welcomeMessage: true,
        allowedExternalLinks: true, // 🛡️ Security
        // 🆕 Channel Configuration (Feature 199)
        enableWhatsapp: true,
        enableWidget: true,
        sellsProductsAndServices: true,
        hasSalesAgents: true,
        hasHumanSupport: true,
        humanSupportInstructions: true,
        operatorContactMethod: true,
        channelType: true,
        operatorEmail: true,
        operatorWhatsappNumber: true,
        toneOfVoice: true,
        botIdentityResponse: true,
        address: true,
        customAiRules: true,
        // 🆕 Widget Configuration
        widgetTitle: true,
        widgetLanguage: true,
        widgetPrimaryColor: true,
        widgetIcon: true,
        // 🆕 Translation Settings
        translateProductNames: true,
        translateCategoryNames: true,
        translateServiceNames: true,
        catalogBaseLanguage: true,
      },
    })

    if (!workspace) return null

    // 🔍 LOG CHANNEL STATUS READ FROM DB
    logger.info(`🔍 GETBYID - channelStatus from DB: ${workspace.channelStatus}, type: ${typeof workspace.channelStatus}`)

    // 2. Query SEPARATA per agentConfigs con FILTRO ESPLICITO per workspaceId
    const agentConfigs = await prisma.agentConfig.findMany({
      where: {
        workspaceId: id, // ← FILTRO ESPLICITO per workspaceId!
        isActive: true,
      },
      select: {
        id: true,
        model: true,
        temperature: true,
        maxTokens: true,
        systemPrompt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    })

    // 🚨 CRITICAL DEBUG: Log what we found
    logger.info(
      `🔍 WORKSPACE.SERVICE: Loading AgentConfigs for workspace ${id}`
    )
    logger.info(`📋 Found ${agentConfigs.length} active AgentConfigs:`)
    agentConfigs.forEach((config, index) => {
      logger.info(
        `  [${index}] ID: ${config.id?.substring(0, 8)}..., Model: ${config.model}, Temp: ${config.temperature}, Updated: ${config.updatedAt}`
      )
    })

    // 3. Combina i risultati
    return {
      ...workspace,
      agentConfigs,
    }
  },

  async create(data: CreateWorkspaceData) {
    // Extract FAQs to handle separately (Prisma relation)
    const { faqs, ...workspaceData } = data
    
    return prisma.workspace.create({
      data: {
        ...workspaceData,
        slug: data.name.toLowerCase().replace(/\s+/g, "-"),
        // Create FAQs as nested relation (if provided)
        ...(faqs && faqs.length > 0 && {
          faqs: {
            createMany: {
              data: faqs.map((faq) => ({
                question: faq.question,
                answer: faq.answer,
              })),
            },
          },
        }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        whatsappPhoneNumber: true,
        whatsappApiKey: true,
        whatsappPhoneNumberId: true,
        whatsappVerifyToken: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        currency: true,
        language: true,
        messageLimit: true,
        channelStatus: true,
        debugMode: true, // 🐞 Debug mode toggle
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        welcomeMessage: true,
        enableWhatsapp: true,
        enableWidget: true,
        widgetTitle: true,
        widgetLanguage: true,
        widgetPrimaryColor: true,
        widgetIcon: true,
      },
    })
  },

  async update(id: string, data: UpdateWorkspaceData) {
    // Separate fields that shouldn't go to Prisma directly
    const { 
      id: _id,  // Remove id if present (shouldn't update primary key)
      adminEmail, // Extract adminEmail separately (goes to WhatsappSettings)
      ...workspaceData 
    } = data as UpdateWorkspaceData & {
      id?: string  // Frontend might send id but we shouldn't update it
    }

    // 🔍 LOG DETTAGLIATO per debug
    logger.info("=== WORKSPACE UPDATE DEBUG ===")
    logger.info("Workspace ID:", id)
    logger.info("Data received:", JSON.stringify(data, null, 2))
    logger.info("debugMode:", data.debugMode, "type:", typeof data.debugMode)
    logger.info("channelStatus:", data.channelStatus, "type:", typeof data.channelStatus)
    logger.info(
      "whatsappApiKey in data:",
      data.whatsappApiKey ? "✅ PRESENTE" : "❌ ASSENTE"
    )
    
    // 🐛 CRITICAL: Check if channelStatus is being passed correctly
    if (data.channelStatus !== undefined) {
      logger.info("✅ channelStatus will be updated to:", data.channelStatus)
    } else {
      logger.warn("⚠️ channelStatus is UNDEFINED, will NOT be updated")
    }
    
    logger.info(
      "Final workspaceData for Prisma:",
      JSON.stringify(workspaceData, null, 2)
    )

    // Update workspace data
    const updatedWorkspace = await prisma.workspace.update({
      where: { id },
      data: {
        ...workspaceData,
        slug: workspaceData.name
          ? workspaceData.name.toLowerCase().replace(/\s+/g, "-")
          : undefined,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        whatsappPhoneNumber: true,
        whatsappApiKey: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        currency: true,
        language: true,
        messageLimit: true,
        channelStatus: true,
        debugMode: true, // 🐞 Debug mode toggle
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        welcomeMessage: true,
        allowedExternalLinks: true, // 🛡️ Security
        // 🆕 Channel Configuration (Feature 199 + Andrea's wizard)
        channelType: true,
        sellsProductsAndServices: true,
        hasSalesAgents: true,
        hasHumanSupport: true,
        humanSupportInstructions: true,
        operatorContactMethod: true,
        operatorEmail: true,
        operatorWhatsappNumber: true,
        toneOfVoice: true,
        botIdentityResponse: true,
        address: true,
        customAiRules: true,
        // 🆕 Widget Configuration
        widgetTitle: true,
        widgetLanguage: true,
        widgetPrimaryColor: true,
        widgetIcon: true,
        // 🆕 Translation Settings
        translateProductNames: true,
        translateCategoryNames: true,
        translateServiceNames: true,
        catalogBaseLanguage: true,
      },
    })

    // 🔍 LOG RISULTATO UPDATE
    logger.info("=== WORKSPACE AFTER UPDATE ===")
    logger.info(
      "Updated whatsappApiKey:",
      updatedWorkspace.whatsappApiKey ? "✅ SALVATA" : "❌ NULL"
    )
    logger.info("channelStatus AFTER UPDATE:", updatedWorkspace.channelStatus, "type:", typeof updatedWorkspace.channelStatus)
    logger.info("Updated workspace:", JSON.stringify(updatedWorkspace, null, 2))

    // Update adminEmail in WhatsappSettings if provided
    if (adminEmail !== undefined) {
      await prisma.whatsappSettings.upsert({
        where: {
          workspaceId: id,
        },
        create: {
          workspaceId: id,
          phoneNumber: updatedWorkspace.whatsappPhoneNumber || "",
          apiKey: updatedWorkspace.whatsappApiKey || "",
          adminEmail: adminEmail,
        },
        update: {
          adminEmail: adminEmail,
        },
      })
    }

    // Return workspace with adminEmail included
    const whatsappSettings = await prisma.whatsappSettings.findUnique({
      where: { workspaceId: id },
    })

    return {
      ...updatedWorkspace,
      adminEmail: whatsappSettings?.adminEmail || null,
    }
  },

  async delete(id: string) {
    // Soft-delete: set deletedAt instead of isDelete
    // Record will be hard-deleted after 90 days by scheduler
    return prisma.workspace.update({
      where: { id },
      data: { 
        deletedAt: new Date(),
      },
    })
  },

  /**
   * Get active prompt content for a workspace from agent_configs table
   * 🔒 SECURITY: This reads from the unified agent_configs table (single source of truth)
   * @param workspaceId string
   * @returns string | null
   */
  async getActivePromptByWorkspaceId(
    workspaceId: string
  ): Promise<string | null> {
    const agentConfig = await prisma.agentConfig.findFirst({
      where: { workspaceId, isActive: true },
      orderBy: { createdAt: "desc" },
    })
    return agentConfig?.systemPrompt || null
  },

  /**
   * Get workspace URL or return default localhost
   * @param workspaceId string
   * @returns string
   */
  async getWorkspaceURL(workspaceId: string): Promise<string> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { url: true },
    })
    return workspace?.url || "http://localhost:3000"
  },
}
