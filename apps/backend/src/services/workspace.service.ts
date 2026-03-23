import { prisma } from "@echatbot/database"
import logger from "../utils/logger"
import { randomBytes } from 'crypto'

// prisma imported

/**
 * Generate unique webhook ID for WhatsApp providers
 * Format: wh_<24 random hex chars>
 * Example: wh_20dbf5340425a7dbba9e3e73
 */
function generateWebhookId(): string {
  return `wh_${randomBytes(12).toString('hex')}`
}

function buildWorkspaceSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return normalized || "channel"
}

async function generateUniqueWorkspaceSlug(value: string): Promise<string> {
  const baseSlug = buildWorkspaceSlug(value)
  let candidate = baseSlug
  let suffix = 1

  while (true) {
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })

    if (!existingWorkspace) {
      return candidate
    }

    suffix += 1
    candidate = `${baseSlug}-${suffix}`
  }
}

interface CreateWorkspaceData {
  name: string
  slug?: string
  description?: string
  channelType?: 'WHATSAPP' | 'WIDGET' // 🆕 Channel type (default: WHATSAPP)
  whatsappPhoneNumber?: string // Required for WHATSAPP channels
  whatsappApiKey?: string
  whatsappAppName?: string
  whatsappAppSecret?: string
  whatsappPhoneNumberId?: string
  whatsappVerifyToken?: string
  whatsappBusinessAccountId?: string
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
  enableWhatsapp?: boolean
  enableWidget?: boolean
  // 🆕 Widget Configuration
  widgetTitle?: string
  widgetLanguage?: string
  widgetPrimaryColor?: string
  widgetIcon?: string
  widgetUseChannelLogo?: boolean
  widgetAutoSuggestionsEnabled?: boolean
  widgetQuickReplies?: string[]
  widgetSuggestionsModel?: string
}

interface UpdateWorkspaceData {
  name?: string
  slug?: string
  description?: string
  channelType?: 'WHATSAPP' | 'WIDGET' // 🆕 Channel type
  whatsappPhoneNumber?: string
  whatsappApiKey?: string
  whatsappAppName?: string
  whatsappAppSecret?: string
  whatsappPhoneNumberId?: string
  whatsappVerifyToken?: string
  whatsappBusinessAccountId?: string
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
  registrationPage?: string | null
  requireManualApproval?: boolean
  // 🆕 Widget Configuration
  widgetTitle?: string
  widgetLanguage?: string
  widgetPrimaryColor?: string
  widgetIcon?: string
  widgetUseChannelLogo?: boolean
  widgetAutoSuggestionsEnabled?: boolean
  widgetQuickReplies?: string[]
  widgetSuggestionsModel?: string
}

export const workspaceService = {
  async getAll() {
    const workspaces = await prisma.workspace.findMany({
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
        whatsappProvider: true, // 🆕 Multi-provider support
        metaPhoneNumberId: true, // 🆕 Meta provider
        metaAccessToken: true, // 🆕 Meta provider  
        ultraMsgInstanceId: true, // 🆕 UltraMsg provider
        ultraMsgToken: true, // 🆕 UltraMsg provider
        ultraMsgApiUrl: true, // 🆕 UltraMsg API URL
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        currency: true,
        language: true,
        defaultLanguage: true, // 🌍 ISO-2 default language
        messageLimit: true,
        channelStatus: true,
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        webhookUrl: true,
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
        registrationPage: true,
        requireManualApproval: true,
        // 🆕 Widget Configuration
        widgetTitle: true,
        widgetLanguage: true,
        widgetPrimaryColor: true,
        widgetIcon: true,
        widgetUseChannelLogo: true,
        widgetAutoSuggestionsEnabled: true,
        widgetQuickReplies: true,
        // 🆕 Translation Settings
        translateProductNames: true,
        translateCategoryNames: true,
        translateServiceNames: true,
        catalogBaseLanguage: true,
        whatsappSettings: {
          select: {
            phoneNumber: true,
            apiKey: true,
            appName: true,
            appSecret: true,
            webhookId: true,
            webhookToken: true,
            webhookUrl: true,
            businessAccountId: true,
            adminEmail: true,
          },
        },
      },
    })

    return workspaces.map((workspace) => {
      const settings = (workspace as any).whatsappSettings
      return {
        ...workspace,
        whatsappPhoneNumber: settings?.phoneNumber ?? workspace.whatsappPhoneNumber,
        whatsappApiKey: settings?.apiKey ?? workspace.whatsappApiKey,
        whatsappAppName: settings?.appName ?? null,
        whatsappAppSecret: settings?.appSecret ?? null,
        whatsappWebhookId: settings?.webhookId ?? null,
        whatsappWebhookToken: settings?.webhookToken ?? null,
        whatsappWebhookUrl: settings?.webhookUrl ?? workspace.webhookUrl ?? null,
        whatsappVerifyToken: settings?.webhookToken ?? workspace.whatsappVerifyToken ?? null,
        whatsappBusinessAccountId: settings?.businessAccountId ?? null,
        adminEmail: settings?.adminEmail ?? null,
      }
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
        whatsappProvider: true, // 🆕 Multi-provider support
        metaPhoneNumberId: true, // 🆕 Meta provider
        metaAccessToken: true, // 🆕 Meta provider  
        ultraMsgInstanceId: true, // 🆕 UltraMsg provider
        ultraMsgToken: true, // 🆕 UltraMsg provider
        ultraMsgApiUrl: true, // 🆕 UltraMsg API URL
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        currency: true,
        language: true,
        defaultLanguage: true, // 🌍 ISO-2 default language
        messageLimit: true,
        channelStatus: true,
        debugMode: true, // 🐞 Debug mode toggle
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        webhookUrl: true,
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
        registrationPage: true,
        requireManualApproval: true,
        // 🆕 Widget Configuration
        widgetTitle: true,
        widgetLanguage: true,
        widgetPrimaryColor: true,
        widgetIcon: true,
        widgetUseChannelLogo: true,
        widgetAutoSuggestionsEnabled: true,
        widgetQuickReplies: true,
        // 🆕 Translation Settings
        translateProductNames: true,
        translateCategoryNames: true,
        translateServiceNames: true,
        catalogBaseLanguage: true,
        whatsappSettings: {
          select: {
            phoneNumber: true,
            apiKey: true,
            appName: true,
            appSecret: true,
            webhookId: true,
            webhookToken: true,
            webhookUrl: true,
            businessAccountId: true,
            adminEmail: true,
          },
        },
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
    const settings = (workspace as any).whatsappSettings
    return {
      ...workspace,
      whatsappPhoneNumber: settings?.phoneNumber ?? workspace.whatsappPhoneNumber,
      whatsappApiKey: settings?.apiKey ?? workspace.whatsappApiKey,
      whatsappAppName: settings?.appName ?? null,
      whatsappAppSecret: settings?.appSecret ?? null,
      whatsappWebhookId: settings?.webhookId ?? null,
      whatsappWebhookToken: settings?.webhookToken ?? null,
      whatsappWebhookUrl: settings?.webhookUrl ?? workspace.webhookUrl ?? null,
      whatsappVerifyToken: settings?.webhookToken ?? workspace.whatsappVerifyToken ?? null,
      whatsappBusinessAccountId: settings?.businessAccountId ?? null,
      adminEmail: settings?.adminEmail ?? null,
      agentConfigs,
    }
  },

  async create(data: CreateWorkspaceData) {
    // Extract FAQs to handle separately (Prisma relation)
    const { faqs, whatsappAppSecret, whatsappAppName, ...workspaceData } = data

    const normalizedChannelName = (workspaceData.name || "").trim()
    if (!normalizedChannelName) {
      throw new Error("Channel name is required")
    }
    workspaceData.name = normalizedChannelName

    // Enforce channel-specific flags
    const channelType = workspaceData.channelType || "WHATSAPP"
    if (channelType === "WIDGET") {
      workspaceData.enableWidget = true
      workspaceData.enableWhatsapp = false
      workspaceData.sellsProductsAndServices = false
      workspaceData.hasSalesAgents = false
      workspaceData.whatsappPhoneNumber = null
    } else {
      workspaceData.enableWhatsapp = true
      workspaceData.enableWidget = false
    }

    if (workspaceData.whatsappPhoneNumber) {
      workspaceData.whatsappPhoneNumber = workspaceData.whatsappPhoneNumber.trim()
    }

    if (!workspaceData.operatorContactMethod) {
      workspaceData.operatorContactMethod = "email"
    }

    if (!workspaceData.operatorEmail && workspaceData.adminEmail) {
      workspaceData.operatorEmail = workspaceData.adminEmail
    }

    // Clamp widget quick replies (max 4, trimmed)
    if (workspaceData.widgetQuickReplies) {
      workspaceData.widgetQuickReplies = workspaceData.widgetQuickReplies
        .map((r) => (r || "").trim())
        .filter((r) => r.length > 0)
        .slice(0, 4)
    }
    if (!workspaceData.widgetAutoSuggestionsEnabled) {
      workspaceData.widgetAutoSuggestionsEnabled = false
    }
    if (!workspaceData.widgetQuickReplies) {
      workspaceData.widgetQuickReplies = []
    }
    if (workspaceData.widgetSuggestionsModel === "") {
      workspaceData.widgetSuggestionsModel = null
    }

    if (channelType === "WHATSAPP" && !workspaceData.whatsappPhoneNumber) {
      throw new Error("WhatsApp phone number is required for WHATSAPP channels")
    }

    const uniqueSlug = await generateUniqueWorkspaceSlug(workspaceData.slug || workspaceData.name)

    // 🛡️ Default allowed external links (always include platform domain)
    if (!workspaceData.allowedExternalLinks || workspaceData.allowedExternalLinks.length === 0) {
      workspaceData.allowedExternalLinks = ["www.echatbot.ai"]
    } else if (!workspaceData.allowedExternalLinks.includes("www.echatbot.ai")) {
      workspaceData.allowedExternalLinks.push("www.echatbot.ai")
    }
    
    const created = await prisma.workspace.create({
      data: {
        ...workspaceData,
        slug: uniqueSlug,
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
        defaultLanguage: true, // 🌍 ISO-2 default language
        messageLimit: true,
        channelStatus: true,
        debugMode: true, // 🐞 Debug mode toggle
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        welcomeMessage: true,
        registrationPage: true,
        requireManualApproval: true,
        enableWhatsapp: true,
        enableWidget: true,
       widgetTitle: true,
       widgetLanguage: true,
       widgetPrimaryColor: true,
       widgetIcon: true,
       widgetUseChannelLogo: true,
        widgetAutoSuggestionsEnabled: true,
        widgetQuickReplies: true,
      },
    })

    if (faqs && faqs.length > 0) {
      const filteredFaqs = faqs.filter((faq) => faq.answer && faq.answer.trim() !== "")
      if (filteredFaqs.length > 0) {
        await prisma.fAQ.createMany({
          data: filteredFaqs.map((faq) => ({
            question: faq.question,
            answer: faq.answer,
            workspaceId: created.id,
          })),
        })
      }
    }

    return created
  },

  async update(id: string, data: UpdateWorkspaceData) {
    // Separate fields that shouldn't go to Prisma directly
    const { 
      id: _id,  // Remove id if present (shouldn't update primary key)
      adminEmail, // Extract adminEmail separately (goes to WhatsappSettings)
      whatsappAppName,
      whatsappAppSecret,
      whatsappVerifyToken,
      whatsappBusinessAccountId,
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
      JSON.stringify(
        {
          ...workspaceData,
          whatsappAppSecret: whatsappAppSecret ? "****" : undefined,
        },
        null,
        2
      )
    )

    // 🛑 FREE PLAN GUARD: max 1 channel (WhatsApp OR Widget) for FREE_TRIAL owners
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { id },
      select: {
        ownerId: true,
        enableWhatsapp: true,
        enableWidget: true,
        deletedAt: true,
      },
    })

    if (existingWorkspace?.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: existingWorkspace.ownerId },
        select: { planType: true },
      })

      const ownerPlan = owner?.planType || "FREE_TRIAL"
      if (ownerPlan === "FREE_TRIAL") {
        const newEnableWhatsapp =
          workspaceData.enableWhatsapp ?? existingWorkspace.enableWhatsapp ?? false
        const newEnableWidget =
          workspaceData.enableWidget ?? existingWorkspace.enableWidget ?? false

        const resultingChannelCount =
          (newEnableWhatsapp ? 1 : 0) + (newEnableWidget ? 1 : 0)

        // Block if trying to enable BOTH channels on same workspace
        if (resultingChannelCount > 1) {
          const err: any = new Error("CHANNEL_LIMIT_EXCEEDED")
          err.statusCode = 403
          throw err
        }

        // Block if another workspace already has an active channel
        if (resultingChannelCount === 1) {
          const otherActiveChannels = await prisma.workspace.count({
            where: {
              ownerId: existingWorkspace.ownerId,
              deletedAt: null,
              id: { not: id },
              OR: [{ enableWhatsapp: true }, { enableWidget: true }],
            },
          })

          if (otherActiveChannels >= 1) {
            const err: any = new Error("CHANNEL_LIMIT_EXCEEDED")
            err.statusCode = 403
            throw err
          }
        }
      }
    }

    // 🛡️ CRITICAL: Strip empty strings to prevent overwriting real DB values with blanks
    // When frontend sends all form fields, empty strings would wipe existing data
    const sanitizedData = Object.fromEntries(
      Object.entries(workspaceData).filter(([_, value]) => value !== "")
    )

    // 🔒 PROTECTION: Preserve boolean toggles if not explicitly passed
    // This prevents accidental state changes when only updating other settings
    const booleanFields = [
      'channelStatus',
      'debugMode',
      'enableWhatsapp',
      'enableWidget',
      'widgetUseChannelLogo',
      'widgetAutoSuggestionsEnabled',
      'hasHumanSupport',
      'requireManualApproval',
      'sellsProductsAndServices',
      'hasSalesAgents',
      'translateProductNames',
      'translateCategoryNames',
      'translateServiceNames',
      'wasenderIsActive'
    ]

    for (const field of booleanFields) {
      if (sanitizedData[field] === undefined) {
        delete sanitizedData[field]
        logger.info(`⚠️ ${field} not provided, preserving existing value`)
      } else {
        logger.info(`✅ ${field} explicitly set to: ${sanitizedData[field]}`)
      }
    }

    // Clamp widget quick replies (max 4, trim, remove empty)
    if (sanitizedData.widgetQuickReplies) {
      const replies = Array.isArray(sanitizedData.widgetQuickReplies)
        ? sanitizedData.widgetQuickReplies
        : []
      sanitizedData.widgetQuickReplies = replies
        .map((r) => (r || "").trim())
        .filter((r) => r.length > 0)
        .slice(0, 4)
    }

    // Update workspace data
    const updatedWorkspace = await prisma.workspace.update({
      where: { id },
      data: {
        ...sanitizedData,
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
        whatsappPhoneNumberId: true,
        whatsappVerifyToken: true,
        webhookUrl: true,  // 🆕 Webhook URL
        whatsappProvider: true, // 🆕 Multi-provider support
        metaPhoneNumberId: true, // 🆕 Meta provider
        metaAccessToken: true, // 🆕 Meta provider  
        ultraMsgInstanceId: true, // 🆕 UltraMsg provider
        ultraMsgToken: true, // 🆕 UltraMsg provider
        ultraMsgApiUrl: true, // 🆕 UltraMsg API URL
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        currency: true,
        language: true,
        defaultLanguage: true, // 🌍 ISO-2 default language
        messageLimit: true,
        channelStatus: true,
        debugMode: true, // 🐞 Debug mode toggle
        wipMessage: true,
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
        registrationPage: true,
        requireManualApproval: true,
        // 🆕 Widget Configuration
        widgetTitle: true,
        widgetLanguage: true,
        widgetPrimaryColor: true,
        widgetIcon: true,
        widgetUseChannelLogo: true,
        // 🆕 Translation Settings
        translateProductNames: true,
        translateCategoryNames: true,
        translateServiceNames: true,
        catalogBaseLanguage: true,
        whatsappSettings: {
          select: {
            phoneNumber: true,
            apiKey: true,
            appName: true,
            appSecret: true,
            webhookId: true,
            webhookToken: true,
            webhookUrl: true,
            businessAccountId: true,
            adminEmail: true,
          },
        },
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

    // Update adminEmail/appSecret in WhatsappSettings if provided
    // 🔧 AUTO-GENERATE webhookId if enabling WhatsApp and it doesn't exist
    if (adminEmail !== undefined || whatsappAppName !== undefined || whatsappAppSecret !== undefined || whatsappVerifyToken !== undefined || whatsappBusinessAccountId !== undefined) {
      // Check if whatsappSettings exists and has webhookId
      const existingSettings = await prisma.whatsappSettings.findUnique({
        where: { workspaceId: id },
        select: { webhookId: true }
      })

      const webhookIdToUse = existingSettings?.webhookId || generateWebhookId()

      await prisma.whatsappSettings.upsert({
        where: {
          workspaceId: id,
        },
        create: {
          workspaceId: id,
          phoneNumber: updatedWorkspace.whatsappPhoneNumber || "",
          apiKey: updatedWorkspace.whatsappApiKey || "",
          webhookId: webhookIdToUse, // ✅ Use existing or generate new
          webhookToken: whatsappVerifyToken || `token-${Date.now()}`,
          ...(adminEmail !== undefined ? { adminEmail } : {}),
          ...(whatsappAppName !== undefined ? { appName: whatsappAppName } : {}),
          ...(whatsappAppSecret !== undefined ? { appSecret: whatsappAppSecret } : {}),
          ...(whatsappBusinessAccountId !== undefined ? { businessAccountId: whatsappBusinessAccountId } : {}),
        },
        update: {
          // ⚠️ NEVER update webhookId once created - it's immutable
          ...(adminEmail !== undefined ? { adminEmail } : {}),
          ...(whatsappAppName !== undefined ? { appName: whatsappAppName } : {}),
          ...(whatsappAppSecret !== undefined ? { appSecret: whatsappAppSecret } : {}),
          ...(whatsappVerifyToken !== undefined ? { webhookToken: whatsappVerifyToken } : {}),
          ...(whatsappBusinessAccountId !== undefined ? { businessAccountId: whatsappBusinessAccountId } : {}),
        },
      })
    }

    // Return workspace with whatsappSettings mapped
    const settings = (updatedWorkspace as any).whatsappSettings
    return {
      ...updatedWorkspace,
      adminEmail: settings?.adminEmail || null,
      whatsappWebhookId: settings?.webhookId || null,
      whatsappWebhookToken: settings?.webhookToken || null,
      whatsappAppSecret: settings?.appSecret || null,
      whatsappAppName: settings?.appName || null,
      whatsappBusinessAccountId: settings?.businessAccountId || null,
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

  /**
   * Get workspace URL and registration page configuration
   * @param workspaceId string
   * @returns object with url and registrationPage
   */
  async getWorkspaceURLWithRegistration(
    workspaceId: string
  ): Promise<{ url: string; registrationPage: string | null }> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { url: true, registrationPage: true, websiteUrl: true },
    })
    return {
      url: workspace?.url || "http://localhost:3000",
      // Prefer explicit registrationPage, fallback to websiteUrl if provided
      registrationPage: workspace?.registrationPage || workspace?.websiteUrl || null,
    }
  },
}
