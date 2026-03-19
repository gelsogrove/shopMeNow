import { prisma, PrismaClient } from "@echatbot/database"
import { randomUUID } from "crypto"
import fs from "fs"
import path from "path"
import {
  Workspace,
  WorkspaceProps,
} from "../../domain/entities/workspace.entity"
import { WorkspaceRepositoryInterface } from "../../domain/repositories/workspace.repository.interface"
import { WorkspaceRepository } from "../../repositories/workspace.repository"
import logger from "../../utils/logger"
import { dynamicAgents } from "../../../prisma/data/dynamicAgents"
import { initialFAQs } from "../../../prisma/data/initialFAQs"
import { WasenderClientService } from "../../services/wasender-client.service"
import { invalidateWorkspaceConfig } from "../chat-engine/chat-engine.service"

export class WorkspaceService {
  private repository: WorkspaceRepositoryInterface
  private prisma: PrismaClient
  private wasenderClient: WasenderClientService

  constructor(prismaInstance?: PrismaClient) {
    this.prisma = prismaInstance || prisma
    this.repository = new WorkspaceRepository(this.prisma)
    this.wasenderClient = new WasenderClientService()
  }

  /**
   * Generate a slug from a name
   * @private
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  /**
   * Get default GDPR content from file
   * @private
   */
  private async getDefaultGdprContent(): Promise<string> {
    try {
      const gdprFilePath = path.join(__dirname, "../../prisma/prompts/gdpr.md")
      return fs.readFileSync(gdprFilePath, "utf8")
    } catch (error) {
      logger.warn("Could not read default GDPR file, using fallback content")
      return `# Privacy Policy

## Data Collection
We collect and process personal data in accordance with applicable privacy laws.

## Data Usage
Your data is used to provide our services and improve user experience.

## Contact
For privacy inquiries, please contact our support team.`
    }
  }

  /**
   * Load default GDPR content in 4 languages from markdown files
   * @private
   */
  private loadDefaultGdprContent(): {
    gdpr_ita: string
    gdpr_eng: string
    gdpr_esp: string
    gdpr_prt: string
  } {
    const gdprDir = path.join(__dirname, "../../../docs/prompts/gdpr")
    const languages = [
      { code: "it", key: "gdpr_ita" },
      { code: "en", key: "gdpr_eng" },
      { code: "es", key: "gdpr_esp" },
      { code: "pt", key: "gdpr_prt" },
    ]

    const result: any = {}

    for (const lang of languages) {
      const filePath = path.join(gdprDir, `gdpr-${lang.code}.md`)
      try {
        const content = fs.readFileSync(filePath, "utf-8")
        result[lang.key] = content
        logger.info(`✓ Loaded GDPR content for language: ${lang.code}`)
      } catch (error) {
        logger.warn(
          `⚠️  Could not read GDPR file for language '${lang.code}' at ${filePath}`
        )
        result[lang.key] = `# GDPR Content - ${lang.code.toUpperCase()}\n\nContent not available.`
      }
    }

    return result
  }

  /**
   * Populate system functions based on workspace type
   * @private
   */
  private async seedSystemFunctions(
    tx: any, // Using any for transaction client
    workspaceId: string,
    isEcommerce: boolean
  ) {
    const functions: any[] = [];

    // E-commerce agents (only if selling products/services)
    if (isEcommerce) {
      functions.push(
        {
          functionName: "productSearchAgent",
          description: "Delegate to Product Search Agent for product catalog browsing, search, filters. Use when customer asks about products, prices, categories, certifications.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Customer's product search query" }
            },
            required: ["query"]
          },
          isSystemFunction: true,
          executionType: "DELEGATE_TO_AGENT",
          isActive: true
        },
        {
          functionName: "cartManagementAgent",
          description: "Delegate to Cart Management Agent for add/remove products, view cart, modify quantities. Use when customer wants to add to cart or modify cart contents.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Cart-related request" }
            },
            required: ["query"]
          },
          isSystemFunction: true,
          executionType: "DELEGATE_TO_AGENT",
          isActive: true
        },
        {
          functionName: "orderTrackingAgent",
          description: "Delegate to Order Tracking Agent for order history, tracking, checkout confirmation. Use for orders, delivery status, checkout.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Order-related question" }
            },
            required: ["query"]
          },
          isSystemFunction: true,
          executionType: "DELEGATE_TO_AGENT",
          isActive: true
        }
      );
    }

    // Always available (both Info and Ecommerce)
    functions.push(
      {
        functionName: "customerSupportAgent",
        description: "Delegate to Customer Support Agent for complaints, issues, human operator contact. Use when customer is frustrated or has problems. NOT for notification management.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Support request" }
          },
          required: ["query"]
        },
        isSystemFunction: true,
        executionType: "DELEGATE_TO_AGENT",
        isActive: true
      },
      {
        functionName: "profileManagementAgent",
        description: "Delegate to Profile Management Agent for email updates, notification preferences, profile data changes. Use for notification subscribe/unsubscribe, email change.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Profile-related request" }
          },
          required: ["query"]
        },
        isSystemFunction: true,
        executionType: "DELEGATE_TO_AGENT",
        isActive: true
      },
      {
        functionName: "manageNotifications",
        description: "Manage push notification preferences (subscribe/unsubscribe).",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["subscribe", "unsubscribe"],
              description: "Action to perform"
            }
          },
          required: ["action"]
        },
        isSystemFunction: true,
        executionType: "INTERNAL",
        isActive: true
      }
    );

    await tx.workspaceCallingFunction.createMany({
      data: functions.map(fn => ({ ...fn, workspaceId }))
    });

    logger.info(`✅ Seeded ${functions.length} system functions for workspace ${workspaceId}`);
  }

  /**
   * Sync system calling functions when workspace type changes (info ↔ ecommerce).
   * - ECOMMERCE-ONLY functions: productSearchAgent, cartManagementAgent, orderTrackingAgent
   *   → enable (or create if missing) when switching TO ecommerce
   *   → disable (isActive=false) when switching TO info
   * - CUSTOM (non-system) functions added by the client are NEVER touched.
   * @private
   */
  private async syncSystemCallingFunctions(workspaceId: string, isEcommerce: boolean): Promise<void> {
    const ECOMMERCE_ONLY_FUNCTIONS = ['productSearchAgent', 'cartManagementAgent', 'orderTrackingAgent']

    if (isEcommerce) {
      // Enable or create the ecommerce-only system functions
      const definitions: Record<string, { description: string; parameters: object }> = {
        productSearchAgent: {
          description: "Delegate to Product Search Agent for product catalog browsing, search, filters. Use when customer asks about products, prices, categories, certifications.",
          parameters: { type: "object", properties: { query: { type: "string", description: "Customer's product search query" } }, required: ["query"] }
        },
        cartManagementAgent: {
          description: "Delegate to Cart Management Agent for add/remove products, view cart, modify quantities. Use when customer wants to add to cart or modify cart contents.",
          parameters: { type: "object", properties: { query: { type: "string", description: "Cart-related request" } }, required: ["query"] }
        },
        orderTrackingAgent: {
          description: "Delegate to Order Tracking Agent for order history, tracking, checkout confirmation. Use for orders, delivery status, checkout.",
          parameters: { type: "object", properties: { query: { type: "string", description: "Order-related question" } }, required: ["query"] }
        },
      }

      for (const functionName of ECOMMERCE_ONLY_FUNCTIONS) {
        try {
          const existing = await this.prisma.workspaceCallingFunction.findUnique({
            where: { workspaceId_functionName: { workspaceId, functionName } }
          })
          if (existing) {
            await this.prisma.workspaceCallingFunction.update({
              where: { workspaceId_functionName: { workspaceId, functionName } },
              data: { isActive: true }
            })
            logger.info(`✅ Re-enabled system function ${functionName} for workspace ${workspaceId}`)
          } else {
            const def = definitions[functionName]
            await this.prisma.workspaceCallingFunction.create({
              data: {
                workspaceId,
                functionName,
                description: def.description,
                parameters: def.parameters,
                isSystemFunction: true,
                executionType: "DELEGATE_TO_AGENT",
                isActive: true
              }
            })
            logger.info(`✅ Created missing system function ${functionName} for workspace ${workspaceId}`)
          }
        } catch (error) {
          logger.warn(`⚠️ Failed to enable/create system function ${functionName}:`, error)
        }
      }
    } else {
      // Disable ONLY ecommerce-only SYSTEM functions — custom client functions are untouched
      try {
        const result = await this.prisma.workspaceCallingFunction.updateMany({
          where: {
            workspaceId,
            functionName: { in: ECOMMERCE_ONLY_FUNCTIONS },
            isSystemFunction: true
          },
          data: { isActive: false }
        })
        logger.info(`✅ Disabled ${result.count} ecommerce system functions for workspace ${workspaceId}`)
      } catch (error) {
        logger.warn(`⚠️ Failed to disable ecommerce system functions:`, error)
      }
    }
  }

  /**
   * Reset all default agent prompts to the correct templates for the workspace type.
   * Called when workspace type changes (sellsProductsAndServices toggled).
   * Uses upsert so missing agents are created and existing ones get the fresh default prompt.
   * @private
   */
  private async resetDefaultAgentPrompts(workspaceId: string, isEcommerce: boolean): Promise<void> {
    const agents = dynamicAgents(workspaceId, isEcommerce)
    let resetCount = 0

    for (const agent of agents) {
      try {
        await this.prisma.agentConfig.upsert({
          where: { workspaceId_type: { workspaceId, type: agent.type } },
          update: {
            systemPrompt: agent.systemPrompt,
            isActive: agent.isActive,
            availableFunctions: agent.availableFunctions as any,
            name: agent.name,
            model: agent.model,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
          },
          create: {
            workspaceId,
            name: agent.name,
            type: agent.type,
            systemPrompt: agent.systemPrompt,
            model: agent.model,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            order: agent.order,
            isActive: agent.isActive,
            availableFunctions: agent.availableFunctions as any,
          }
        })
        resetCount++
      } catch (error) {
        logger.warn(`⚠️ Failed to reset prompt for agent ${agent.type}:`, error)
      }
    }

    logger.info(`✅ Reset ${resetCount} default agent prompts for workspace ${workspaceId} (ecommerce: ${isEcommerce})`)
  }

  /**
   * Get default agent prompt content from file
   * @private
   */
  private async getDefaultAgentContent(): Promise<string> {
    try {
      // Try to read from the default agent prompt file
      const agentFilePath = path.join(
        __dirname,
        "../../prisma/prompts/default-agent.md"
      )
      return fs.readFileSync(agentFilePath, "utf8")
    } catch (error) {
      // Fallback to GDPR file if default agent file doesn't exist
      try {
        const gdprFilePath = path.join(
          __dirname,
          "../../prisma/prompts/gdpr.md"
        )
        return fs.readFileSync(gdprFilePath, "utf8")
      } catch (gdprError) {
        logger.warn(
          "Could not read default agent prompt files, using fallback content"
        )
        return `You are a helpful AI assistant for customer support. Please assist users with their inquiries in a professional and friendly manner.`
      }
    }
  }

  /**
   * Get all workspaces
   */
  async getAll(): Promise<Workspace[]> {
    logger.info("Getting all workspaces")
    return this.repository.findAll()
  }

  /**
   * Get workspaces by user ID (workspace isolation)
   * SECURITY: Returns ONLY workspaces the user has access to via UserWorkspace relation
   */
  async getByUserId(userId: string): Promise<Workspace[]> {
    logger.info(`Getting workspaces for user: ${userId}`)

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
        createdAt: "desc",
      },
      include: {
        owner: {
          select: {
            planType: true,
            trialEndsAt: true,
          },
        },
        whatsappSettings: {
          select: {
            webhookId: true,
            webhookToken: true,
            appSecret: true,
            appName: true,
            businessAccountId: true,
          },
        },
      },
    })

    // Convert to Workspace entities
    return workspaces.map(w => new Workspace({
      id: w.id,
      name: w.name,
      slug: w.slug,
      description: w.description ?? undefined,
      whatsappPhoneNumber: w.whatsappPhoneNumber ?? undefined,
      whatsappApiKey: w.whatsappApiKey ?? undefined,
      whatsappAppName: (w as any).whatsappSettings?.appName ?? null,
      whatsappAppSecret: (w as any).whatsappSettings?.appSecret ?? null,
      whatsappPhoneNumberId: (w as any).whatsappPhoneNumberId ?? undefined,
      whatsappVerifyToken: (w as any).whatsappVerifyToken ?? undefined,
      whatsappWebhookToken: (w as any).whatsappSettings?.webhookToken ?? null,
      whatsappBusinessAccountId: (w as any).whatsappSettings?.businessAccountId ?? null,
      // 🆕 Multi-Provider WhatsApp Support
      whatsappProvider: (w as any).whatsappProvider ?? (w.ultraMsgInstanceId || w.ultraMsgToken ? "ultramsg" : "meta"),
      metaPhoneNumberId: (w as any).metaPhoneNumberId ?? (w as any).whatsappPhoneNumberId ?? undefined,
      metaAccessToken: (w as any).metaAccessToken ?? (w as any).whatsappApiKey ?? undefined,
      webhookVerifyToken: (w as any).webhookVerifyToken ?? (w as any).whatsappVerifyToken ?? undefined,
      ultraMsgInstanceId: (w as any).ultraMsgInstanceId ?? undefined,
      ultraMsgToken: (w as any).ultraMsgToken ?? undefined,
      ultraMsgApiUrl: (w as any).ultraMsgApiUrl ?? undefined,
      webhookUrl: w.webhookUrl ?? undefined,
      notificationEmail: w.notificationEmail ?? undefined,
      language: w.language ?? 'it',
      defaultLanguage: (w as any).defaultLanguage ?? 'it', // 🌍 ISO-2 default language for customers
      currency: w.currency ?? 'USD',
      messageLimit: w.messageLimit ?? 1000,
      welcomeMessage: w.welcomeMessage ?? undefined,
      wipMessage: w.wipMessage ?? undefined,
      channelStatus: w.channelStatus,
      deletedAt: w.deletedAt ?? null,
      url: w.url ?? undefined,
      debugMode: w.debugMode ?? false,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      // 💳 Feature 198: Use owner's billing info
      planType: w.owner?.planType ?? undefined,
      trialEndsAt: w.owner?.trialEndsAt ?? undefined,
      // 🆕 Channel Configuration (Feature 199) - CRITICAL: Must include these!
      channelType: (w as any).channelType ?? "WHATSAPP",
      enableWhatsapp: (w as any).enableWhatsapp ?? true,
      enableWidget: (w as any).enableWidget ?? false,
      sellsProductsAndServices: w.sellsProductsAndServices,
      hasSalesAgents: w.hasSalesAgents,
      hasHumanSupport: w.hasHumanSupport,
      humanSupportInstructions: w.humanSupportInstructions ?? undefined,
      frustrationEscalationInstructions: w.frustrationEscalationInstructions ?? undefined,
      operatorContactMethod: w.operatorContactMethod ?? undefined,
      operatorEmail: (w as any).operatorEmail ?? undefined,
      operatorWhatsappNumber: w.operatorWhatsappNumber ?? undefined,
      toneOfVoice: w.toneOfVoice ?? undefined,
      botIdentityResponse: w.botIdentityResponse ?? undefined,
      address: w.address ?? undefined,
      customAiRules: w.customAiRules ?? undefined,
      registrationPage: w.registrationPage ?? undefined,
      requireManualApproval: w.requireManualApproval ?? false,
      // 🆕 Logo
      logoUrl: w.logoUrl ?? undefined,
      // 🆕 Widget Configuration
      widgetTitle: (w as any).widgetTitle ?? undefined,
      widgetLanguage: (w as any).widgetLanguage ?? undefined,
      widgetPrimaryColor: (w as any).widgetPrimaryColor ?? undefined,
      widgetIcon: (w as any).widgetIcon ?? "chat",
      widgetUseChannelLogo: (w as any).widgetUseChannelLogo ?? false,
      widgetLogoUrl: (w as any).widgetLogoUrl ?? undefined,
      widgetLogoKey: (w as any).widgetLogoKey ?? undefined,
    }))
  }

  /**
   * Get a workspace by ID
   */
  async getById(id: string): Promise<Workspace | null> {
    logger.info(`Getting workspace by ID: ${id}`)
    return this.repository.findById(id)
  }

  /**
   * Find a workspace by slug
   */
  async getBySlug(slug: string): Promise<Workspace | null> {
    logger.info(`Getting workspace by slug: ${slug}`)
    return this.repository.findBySlug(slug)
  }

  /**
   * Create a new workspace
   * @param data - Workspace data (must include createdBy for UserWorkspace relation)
   */
  async create(data: WorkspaceProps & { createdBy?: string }): Promise<Workspace> {
    logger.info("Creating new workspace with default settings and agents")

    // Generate a slug if not provided
    if (!data.slug) {
      data.slug = this.generateSlug(data.name)
    }

    // Check if workspace with same slug exists
    const existingWorkspace = await this.repository.findBySlug(data.slug)
    if (existingWorkspace) {
      throw new Error(`Workspace with name "${data.name}" already exists`)
    }

    // Generate UUID if not provided
    if (!data.id) {
      data.id = randomUUID()
    }

    // Extract userId for UserWorkspace relation
    const createdBy = data.createdBy
    const adminEmail = (data as any).adminEmail // Extract adminEmail for WhatsappSettings
    const customFaqs = (data as any).faqs // 🆕 Extract custom FAQs from wizard (Feature 199)
    const workspaceData = { ...data }
    delete (workspaceData as any).createdBy // Remove from workspace data
    delete (workspaceData as any).adminEmail // Remove from workspace data (stored in WhatsappSettings)
    delete (workspaceData as any).faqs // Remove FAQs from workspace data (stored in separate table)

    // 🆕 DEFAULT WELCOME AND WIP MESSAGES (English only - Translation Agent will translate)
    const defaultWelcomeMessage = "Welcome! I'm {{chatbotName}}, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?"
    const defaultWipMessage = "Work in progress. Please contact us later."
    const defaultAfterRegistrationMessage = "Thank you for registering, {{customerName}}! How can I help you today? Would you like to see your orders? The offers? Or do you need other information?"

    // Add messages to workspace data (only if not provided)
    if (!data.welcomeMessage) data.welcomeMessage = defaultWelcomeMessage
    if (!data.wipMessage) data.wipMessage = defaultWipMessage
    if (!data.afterRegistrationMessages) data.afterRegistrationMessages = defaultAfterRegistrationMessage

    // 🆕 Feature 199: Set default channel configuration values
    // These can be overridden by wizard input, but provide sensible defaults
    if (data.hasHumanSupport === undefined) data.hasHumanSupport = true
    if (data.hasSalesAgents === undefined) data.hasSalesAgents = false
    if (data.sellsProductsAndServices === undefined) data.sellsProductsAndServices = true
    if (data.toneOfVoice === undefined) data.toneOfVoice = "friendly"
    if (data.operatorContactMethod === undefined) data.operatorContactMethod = "EMAIL"
    // 🌍 Default languages: force English as baseline for new workspaces
    if (!data.defaultLanguage) data.defaultLanguage = "en"
    if (!data.language) data.language = "en"

    // Default provider for new WhatsApp channels
    if (!data.whatsappProvider) data.whatsappProvider = "wasender"

    // 🚨 CRITICAL: Widget + E-commerce Validation (Andrea's Rule)
    // Widget visitors use temporary visitorId (24h localStorage expiry)
    // → cannot guarantee cart/order persistence → e-commerce impossible
    // See: .specify/widget-ecommerce-restriction/spec.md

    // Enforce channel-specific flags
    const channelType = data.channelType || "WHATSAPP"
    if (channelType === "WIDGET" || data.enableWidget === true) {
      // Widget channel = support/info only, no e-commerce
      if (data.sellsProductsAndServices === true) {
        logger.warn(`❌ Attempted to create widget workspace with e-commerce enabled`)
        const err: any = new Error(
          "Widget channel cannot be enabled for e-commerce workspaces. " +
          "E-commerce requires WhatsApp for persistent customer identification."
        )
        err.statusCode = 400
        err.code = "VALIDATION_ERROR"
        err.field = "enableWidget"
        throw err
      }

      data.enableWidget = true
      data.enableWhatsapp = false
      data.sellsProductsAndServices = false  // Force false for widget
      data.hasSalesAgents = false            // No sales agents for widget
      data.whatsappPhoneNumber = null
    } else {
      data.enableWhatsapp = true
      data.enableWidget = false
    }

    // Default human support instructions (English - Translation Agent handles customer language)
    if (!data.humanSupportInstructions) {
      if (data.hasHumanSupport) {
        if (data.hasSalesAgents) {
          data.humanSupportInstructions =
            `Hello {{nameUser}}, I'm connecting you with agent {{agentName}}.\nThey will contact you as soon as possible (phone: {{agentPhone}} - email: {{agentEmail}}).\nThe chatbot is paused until you receive a response.`
        } else {
          data.humanSupportInstructions =
            `Hello {{nameUser}}, I'm connecting you with our operator.\nThey will respond as soon as possible.\nThe chatbot is paused until you receive assistance.`
        }
      } else {
        data.humanSupportInstructions =
          "I'm sorry for the inconvenience. You can send us an email at {{adminEmail}} and we'll get back to you as soon as possible."
      }
    }

    // Default bot identity
    if (!data.botIdentityResponse) {
      data.botIdentityResponse = "I'm your digital assistant. I can help you find products, answer questions, and manage your orders!"
    }

    // 🆕 SET PLAN TYPE AND TRIAL END DATE
    // New workspaces default to FREE_TRIAL with 14-day trial period
    if (!data.planType) {
      data.planType = 'FREE_TRIAL'
    }

    if (data.planType === 'FREE_TRIAL' && !data.trialEndsAt) {
      const trialDays = 14 // Free trial duration in days
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)
      data.trialEndsAt = trialEndsAt
      logger.info(`✓ Set FREE_TRIAL plan with end date ${trialEndsAt.toISOString()} (${trialDays} days from now)`)
    }

    // Create workspace entity
    const workspace = Workspace.create(data)

    // Use transaction to create workspace and related records
    return await prisma.$transaction(async (tx) => {
      // 1. Create the workspace
      const createdWorkspace = await this.repository.create(workspace)

      logger.info(
        `Created workspace ${createdWorkspace.id}, now importing default agents`
      )

      // 2. Create default GDPR settings
      try {
        const defaultGdprContent = await this.getDefaultGdprContent()
        await tx.whatsappSettings.create({
          data: {
            workspaceId: createdWorkspace.id,
            phoneNumber: `+34-${createdWorkspace.id.substring(0, 8)}`,
            apiKey: "default-api-key",
            appName: data.whatsappAppName || undefined,
            appSecret: data.whatsappAppSecret || undefined,
            webhookId: `webhook-${createdWorkspace.id}`,
            webhookToken: data.whatsappVerifyToken || `token-${Date.now()}`,
            gdpr: defaultGdprContent,
            adminEmail: adminEmail || null, // 🆕 Use adminEmail from creator
          },
        })
        logger.info(
          `Created default GDPR settings for workspace ${createdWorkspace.id}`
        )
      } catch (error) {
        logger.error(
          `Error creating GDPR settings for workspace ${createdWorkspace.id}:`,
          error
        )
        // Don't fail the entire transaction for GDPR settings
      }

      // 3. 🆕 IMPORT ALL DEFAULT AGENTS (Feature: Import prompts on new workspace)
      // Use dynamicAgents with correct template folder based on workspace type
      try {
        const hasEcommerce = data.sellsProductsAndServices ?? true
        const agents = dynamicAgents(createdWorkspace.id, hasEcommerce)
        logger.info(`Loading ${hasEcommerce ? 'e-commerce' : 'informational'} templates for workspace ${createdWorkspace.id}`)
        for (const agent of agents) {
          await tx.agentConfig.create({
            data: {
              workspaceId: createdWorkspace.id,
              name: agent.name,
              type: agent.type,
              description: agent.description,
              icon: agent.icon,
              systemPrompt: agent.systemPrompt,
              model: agent.model,
              temperature: agent.temperature,
              maxTokens: agent.maxTokens,
              order: agent.order,
              isActive: agent.isActive,
              availableFunctions: agent.availableFunctions,
            },
          })
        }
        logger.info(
          `✅ Imported ${agents.length} agents for workspace ${createdWorkspace.id}`
        )

        // 3b. 🆕 Seed system functions based on workspace type
        await this.seedSystemFunctions(tx, createdWorkspace.id, hasEcommerce);
      } catch (error) {
        logger.error(
          `Error importing agents for workspace ${createdWorkspace.id}:`,
          error
        )
        // Don't fail the entire transaction for agent settings
      }

      // 4. 🆕 CREATE DEFAULT GDPR CONTENT (Feature: Auto-create GDPR on new workspace)
      try {
        const gdprContent = this.loadDefaultGdprContent()
        await tx.gdprContent.create({
          data: {
            workspaceId: createdWorkspace.id,
            gdpr_ita: gdprContent.gdpr_ita,
            gdpr_eng: gdprContent.gdpr_eng,
            gdpr_esp: gdprContent.gdpr_esp,
            gdpr_prt: gdprContent.gdpr_prt,
          },
        })
        logger.info(
          `✅ Created GDPR content in 4 languages for workspace ${createdWorkspace.id}`
        )
      } catch (error) {
        logger.error(
          `Error creating GDPR content for workspace ${createdWorkspace.id}:`,
          error
        )
        // Don't fail the entire transaction for GDPR content
      }

      // 4b. 🆕 CREATE FAQs (Feature 199: Use wizard FAQs if provided, otherwise defaults)
      try {
        // Use custom FAQs from wizard if provided, otherwise use default FAQs
        const faqsToCreate = (customFaqs && customFaqs.length > 0)
          ? customFaqs.map((faq: { question: string; answer: string }, index: number) => ({
            question: faq.question,
            answer: faq.answer,
            keywords: [], // Will be populated by user later
            category: 'General',
            order: index,
            isActive: true,
          }))
          : initialFAQs(createdWorkspace.id)

        for (const faq of faqsToCreate) {
          await tx.fAQ.create({
            data: {
              workspaceId: createdWorkspace.id,
              question: faq.question,
              answer: faq.answer,
              keywords: faq.keywords || [],
              category: faq.category || 'General',
              order: faq.order ?? 0,
              isActive: faq.isActive ?? true,
            },
          })
        }
        const faqSource = (customFaqs && customFaqs.length > 0) ? 'wizard' : 'default'
        logger.info(
          `✅ Created ${faqsToCreate.length} FAQs (${faqSource}) for workspace ${createdWorkspace.id}`
        )
      } catch (error) {
        logger.error(
          `Error creating FAQs for workspace ${createdWorkspace.id}:`,
          error
        )
        // Don't fail the entire transaction for FAQs
      }

      // 5. 🆕 CREATE USER-WORKSPACE RELATION AND SET OWNER (Feature 184: Team Management)
      if (createdBy) {
        try {
          // Set the workspace owner
          await tx.workspace.update({
            where: { id: createdWorkspace.id },
            data: { ownerId: createdBy },
          })
          logger.info(
            `✅ Set workspace owner: ${createdBy} for workspace ${createdWorkspace.id}`
          )

          // Create UserWorkspace relation with SUPER_ADMIN role
          await tx.userWorkspace.create({
            data: {
              userId: createdBy,
              workspaceId: createdWorkspace.id,
              role: 'SUPER_ADMIN', // Creator is SUPER_ADMIN (Feature 184)
            },
          })
          logger.info(
            `✅ Created UserWorkspace relation: user ${createdBy} → workspace ${createdWorkspace.id} (SUPER_ADMIN)`
          )

          // 6. 💰 CREATE INITIAL CREDIT TRANSACTION (Welcome bonus from plan configuration)
          try {
            // Get the FREE_TRIAL plan configuration to get the initial credit amount
            const freeTrial = await tx.planConfiguration.findFirst({
              where: { planType: 'FREE_TRIAL' }
            })

            // Convert Decimal to number (Prisma returns Decimal type)
            const initialCredit = freeTrial?.initialCredit
              ? Number(freeTrial.initialCredit)
              : 22.00 // Fallback to €22 if not found

            if (initialCredit > 0 && createdBy) {
              // Feature 198: Update owner's credit balance (not workspace)
              await tx.user.update({
                where: { id: createdBy },
                data: { creditBalance: initialCredit }
              })

              // Create the billing transaction record
              // Feature 198: userId is required, workspaceId tracks which channel
              await tx.billingTransaction.create({
                data: {
                  userId: createdBy,
                  workspaceId: createdWorkspace.id,
                  type: 'INITIAL_CREDIT',
                  amount: initialCredit,
                  balanceAfter: initialCredit,
                  description: 'Initial Free Trial credit',
                }
              })

              logger.info(
                `✅ Created initial credit transaction: €${initialCredit} for workspace ${createdWorkspace.id}`
              )
            }
          } catch (error) {
            logger.error(
              `Error creating initial credit for workspace ${createdWorkspace.id}:`,
              error
            )
            // Don't fail the entire transaction for billing
          }

          // 7. 🆕 AUTO-ADD EXISTING ADMINS (Feature 184: New channel propagation)
          // Find all workspaces owned by this user and get their ADMINs
          const existingOwnerWorkspaces = await tx.workspace.findMany({
            where: {
              ownerId: createdBy,
              id: { not: createdWorkspace.id }, // Exclude the new workspace
            },
            select: { id: true },
          })

          if (existingOwnerWorkspaces.length > 0) {
            // Get all unique ADMINs from owner's other workspaces
            const existingAdmins = await tx.userWorkspace.findMany({
              where: {
                workspaceId: { in: existingOwnerWorkspaces.map(w => w.id) },
                role: 'ADMIN',
              },
              select: { userId: true },
              distinct: ['userId'],
            })

            // Add each ADMIN to the new workspace
            let adminsAdded = 0
            for (const admin of existingAdmins) {
              await tx.userWorkspace.create({
                data: {
                  userId: admin.userId,
                  workspaceId: createdWorkspace.id,
                  role: 'ADMIN',
                },
              })
              adminsAdded++
            }

            if (adminsAdded > 0) {
              logger.info(
                `✅ Auto-added ${adminsAdded} existing ADMINs to new workspace ${createdWorkspace.id}`
              )
            }
          }
        } catch (error) {
          logger.error(
            `❌ CRITICAL: Failed to create UserWorkspace relation for user ${createdBy}:`,
            error
          )
          // This SHOULD fail the transaction - user must be linked to workspace
          throw error
        }
      } else {
        logger.warn(
          `⚠️ No createdBy userId provided - workspace ${createdWorkspace.id} has no owner!`
        )
      }

      return createdWorkspace
    })
  }

  /**
   * Update a workspace
   */
  async update(
    id: string,
    data: Partial<WorkspaceProps>
  ): Promise<Workspace | null> {
    logger.info(`Updating workspace with ID: ${id}`)

    // 🔍 DEBUG: Log frustrationEscalationInstructions EXPLICITLY (Andrea debug)
    if (data.frustrationEscalationInstructions !== undefined) {
      logger.warn(`🚨 FRUSTRATION ESCALATION UPDATE:`)
      logger.warn(`   Value: "${data.frustrationEscalationInstructions}"`)
      logger.warn(`   Length: ${data.frustrationEscalationInstructions?.length || 0} chars`)
      logger.warn(`   Is NULL: ${data.frustrationEscalationInstructions === null}`)
      logger.warn(`   Is EMPTY: ${data.frustrationEscalationInstructions === ''}`)
    } else {
      logger.warn(`⚠️ frustrationEscalationInstructions NOT in update payload`)
    }

    // 🔍 DEBUG: Log chatbotName specifically
    if (data.chatbotName !== undefined) {
      logger.info(`🤖 chatbotName in update data: "${data.chatbotName}"`)
    }

    // 🚨 CRITICAL: Widget + E-commerce Validation (Andrea's Rule)
    // Widget visitors use temporary visitorId (24h localStorage expiry) 
    // → cannot guarantee cart/order persistence → e-commerce impossible
    // See: .specify/widget-ecommerce-restriction/spec.md

    // Load current workspace to check state + detect provider switch
    const currentWorkspace = await this.prisma.workspace.findUnique({
      where: { id },
      select: {
        enableWidget: true,
        enableWhatsapp: true,
        sellsProductsAndServices: true,
        ownerId: true,
        deletedAt: true,
        whatsappProvider: true,
        wasenderSessionId: true,
      },
    })

    // Provider switch cleanup: if moving AWAY from wasender → delete Wasender session on WasenderAPI
    const switchingAwayFromWasender =
      data.whatsappProvider &&
      data.whatsappProvider !== 'wasender' &&
      currentWorkspace?.whatsappProvider === 'wasender' &&
      currentWorkspace?.wasenderSessionId

    if (switchingAwayFromWasender) {
      try {
        await this.wasenderClient.deleteSession(currentWorkspace!.wasenderSessionId!)
        logger.info('[Workspace] Wasender session deleted due to provider switch:', {
          id,
          from: 'wasender',
          to: data.whatsappProvider,
        })
      } catch (err) {
        logger.warn('[Workspace] Failed to delete Wasender session on provider switch (continuing):', err)
      }
      // Clear all wasender fields from DB
      const d = data as any
      d.wasenderSessionId = null
      d.wasenderApiKey = null
      d.wasenderSessionStatus = null
      d.wasenderPhoneNumber = null
      d.wasenderQrString = null
      d.wasenderQrGeneratedAt = null
      d.wasenderIsActive = false
    }

    if (!currentWorkspace) {
      throw new Error(`Workspace not found: ${id}`)
    }

    // Calculate resulting state
    const willEnableWidget = data.enableWidget ?? currentWorkspace.enableWidget ?? false
    const willSellProducts = data.sellsProductsAndServices ?? currentWorkspace.sellsProductsAndServices ?? false

    // Validate: Widget + E-commerce is forbidden
    if (willEnableWidget && willSellProducts) {
      logger.warn(`❌ Attempted to enable widget on e-commerce workspace (or vice versa)`)
      const err: any = new Error(
        willEnableWidget && data.enableWidget !== undefined
          ? "Cannot enable widget for e-commerce workspaces. Disable e-commerce features first."
          : "Cannot enable e-commerce for widget workspaces. Disable widget first, then switch to WhatsApp."
      )
      err.statusCode = 400
      err.code = "VALIDATION_ERROR"
      err.field = data.enableWidget !== undefined ? "enableWidget" : "sellsProductsAndServices"
      err.currentState = {
        enableWidget: currentWorkspace.enableWidget,
        sellsProductsAndServices: currentWorkspace.sellsProductsAndServices
      }
      throw err
    }

    // When workspace type changes: sync calling functions + reset default prompts
    if (data.sellsProductsAndServices !== undefined &&
        data.sellsProductsAndServices !== currentWorkspace.sellsProductsAndServices) {
      const isEcommerce = data.sellsProductsAndServices
      logger.info(`🔄 Workspace type changed → ecommerce: ${isEcommerce} — syncing functions & prompts`)
      await this.syncSystemCallingFunctions(id, isEcommerce)
      await this.resetDefaultAgentPrompts(id, isEcommerce)
    }

    // Generate slug if name is updated and slug is not provided
    if (data.name && !data.slug) {
      data.slug = this.generateSlug(data.name)

      // Check for slug uniqueness if it has changed
      const existingWorkspace = await this.repository.findBySlug(data.slug)
      if (existingWorkspace && existingWorkspace.id !== id) {
        throw new Error(`Workspace with name "${data.name}" already exists`)
      }
    }

    // 🛑 FREE PLAN GUARD: max 1 channel (WhatsApp OR Widget) for FREE_TRIAL owners
    // Note: currentWorkspace already loaded above for widget validation

    if (currentWorkspace?.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: currentWorkspace.ownerId },
        select: { planType: true },
      })

      const ownerPlan = owner?.planType || "FREE_TRIAL"
      if (ownerPlan === "FREE_TRIAL") {
        // 🚨 CRITICAL: Only check limits if user is CHANGING channel toggles
        // Allow editing other settings (name, logo, etc.) without blocking
        const isChangingWhatsapp = data.enableWhatsapp !== undefined && data.enableWhatsapp !== currentWorkspace.enableWhatsapp
        const isChangingWidget = data.enableWidget !== undefined && data.enableWidget !== currentWorkspace.enableWidget

        // If NOT changing channel toggles, skip limit check (allow settings edit)
        if (!isChangingWhatsapp && !isChangingWidget) {
          logger.info(`✅ Allowing settings edit for FREE_TRIAL user (not changing channel toggles)`)
          const updated = await this.repository.update(id, data)
          invalidateWorkspaceConfig(id)
          return updated
        }

        // User IS trying to change channel toggles - check limits
        const newEnableWhatsapp = data.enableWhatsapp ?? currentWorkspace.enableWhatsapp ?? false
        const newEnableWidget = data.enableWidget ?? currentWorkspace.enableWidget ?? false

        const resultingChannelCount =
          (newEnableWhatsapp ? 1 : 0) + (newEnableWidget ? 1 : 0)

        if (resultingChannelCount > 1) {
          logger.warn(`❌ FREE_TRIAL user trying to enable both WhatsApp and Widget`)
          const err: any = new Error("CHANNEL_LIMIT_EXCEEDED")
          err.statusCode = 403
          throw err
        }

        if (resultingChannelCount === 1) {
          const otherActiveChannels = await this.prisma.workspace.count({
            where: {
              ownerId: currentWorkspace.ownerId,
              deletedAt: null,
              id: { not: id },
              OR: [{ enableWhatsapp: true }, { enableWidget: true }],
            },
          })

          if (otherActiveChannels >= 1) {
            logger.warn(`❌ FREE_TRIAL user already has ${otherActiveChannels} active channel(s) - cannot enable another`)
            const err: any = new Error("CHANNEL_LIMIT_EXCEEDED")
            err.statusCode = 403
            throw err
          }
        }
      }
    }

    const updated = await this.repository.update(id, data)
    invalidateWorkspaceConfig(id)
    return updated
  }

  /**
   * Delete a workspace
   * IMPORTANT: Clean up provider sessions before soft-deleting to avoid zombie sessions
   */
  async delete(id: string): Promise<boolean> {
    logger.info(`Deleting workspace with ID: ${id}`)

    // Cleanup any active Wasender session on WasenderAPI servers
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      select: { wasenderSessionId: true },
    })

    if (workspace?.wasenderSessionId) {
      try {
        await this.wasenderClient.deleteSession(workspace.wasenderSessionId)
        logger.info('[Workspace] Wasender session deleted during workspace delete:', { id })
      } catch (err) {
        // Log but don't block delete — session may already be gone
        logger.warn('[Workspace] Failed to delete Wasender session (continuing):', err)
      }
    }

    return this.repository.delete(id)
  }

  /**
   * Get workspaces for a user
   */
  async getWorkspacesForUser(userId: string): Promise<Workspace[]> {
    logger.info(`Getting workspaces for user: ${userId}`)
    return this.repository.findByUserId(userId)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WasenderAPI Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialize WasenderAPI session and start QR onboarding flow.
   *
   * STEPS:
   * 1. Verify user subscription / credits
   * 2. Check if workspace already has a WasenderAPI session
   *    - YES → call connectSession() to get fresh QR (don't create duplicate)
   *    - NO  → create new session + connect
   * 3. Save credentials to workspace
   *
   * PREREQUISITE: User must have active subscription + credits
   */
  async initializeWasenderSession(
    workspaceId: string,
    userId: string,
    phoneNumber?: string
  ) {
    // STEP 0: Verify subscription
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        planType: true,
        creditBalance: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    })

    if (!user) throw new Error('User not found')

    if (user.planType === 'FREE_TRIAL') {
      if (!user.trialEndsAt || new Date() > user.trialEndsAt) {
        throw new Error('Trial expired. Please upgrade to create a channel.')
      }
    }

    if (user.subscriptionStatus !== 'ACTIVE') {
      throw new Error('Active subscription required. Please upgrade your plan.')
    }

    if (Number(user.creditBalance) < 5.0) {
      throw new Error('Insufficient credits. Minimum €5.00 required to create channel.')
    }

    // STEP 1: Check if workspace already has a WasenderAPI session
    const existingWorkspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        wasenderSessionId: true,
        wasenderApiKey: true,
        wasenderSessionStatus: true,
        wasenderPhoneNumber: true,
        whatsappPhoneNumber: true,
      },
    })

    // Phone number is optional — fall back to workspace's stored phone or empty string
    // WasenderAPI only uses it as a label, not for QR-based authentication
    const effectivePhone = phoneNumber
      || existingWorkspace?.wasenderPhoneNumber
      || existingWorkspace?.whatsappPhoneNumber
      || ''

    let sessionId: string
    let apiKey: string

    const createNewSession = async () => {
      const webhookUrl = `${process.env.APP_WEBHOOK_BASE_URL}/api/v1/wasender/webhook/${workspaceId}`
      const result = await this.wasenderClient.createSession(
        workspaceId,
        effectivePhone,
        webhookUrl
      )
      return result
    }

    if (existingWorkspace?.wasenderSessionId) {
      // Session already exists → reuse it, just reconnect for fresh QR
      sessionId = existingWorkspace.wasenderSessionId
      apiKey = existingWorkspace.wasenderApiKey || ''

      logger.info('[Workspace] Reusing existing Wasender session:', {
        workspaceId,
        sessionId,
        previousStatus: existingWorkspace.wasenderSessionStatus,
      })

      // CRITICAL: Always re-set webhook URL when reusing — it may be missing or stale
      // (e.g. session created manually, or APP_WEBHOOK_BASE_URL changed)
      const webhookUrl = `${process.env.APP_WEBHOOK_BASE_URL}/api/v1/wasender/webhook/${workspaceId}`
      await this.wasenderClient.updateSessionWebhook(sessionId, webhookUrl)
    } else {
      // No session in DB → check WasenderAPI for existing sessions that our DB
      // lost track of (created via dashboard, DB reset, previous init failed after
      // creating session but before saving, etc.)
      const adopted = await this.adoptExistingWasenderSession(workspaceId)

      if (adopted) {
        sessionId = adopted.sessionId
        apiKey = adopted.apiKey
        logger.info('[Workspace] Adopted existing Wasender session:', {
          workspaceId,
          sessionId,
        })
      } else {
        // No existing sessions on WasenderAPI → create new one
        const result = await createNewSession()
        sessionId = result.sessionId
        apiKey = result.apiKey
      }
    }

    // STEP 2: Connect → get fresh QR string
    // If session is stale (404), clear it and create a new one
    let qrString: string | null
    try {
      qrString = await this.wasenderClient.connectSession(sessionId)
    } catch (connectError: any) {
      if (connectError.message === 'WASENDER_SESSION_NOT_FOUND') {
        logger.warn('[Workspace] Stale session detected, creating new one:', { workspaceId, staleSessionId: sessionId })

        // Clear stale data and create fresh session
        const result = await createNewSession()
        sessionId = result.sessionId
        apiKey = result.apiKey

        // Connect the newly created session
        qrString = await this.wasenderClient.connectSession(sessionId)
      } else {
        throw connectError
      }
    }

    // If connectSession returns null → session is already connected (no QR needed)
    const sessionStatus = qrString ? 'need_scan' : 'connected'
    const isActive = !qrString // connected = active, need_scan = not active yet

    // STEP 3: Save to workspace
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        whatsappProvider: 'wasender',
        wasenderSessionId: sessionId,
        wasenderApiKey: apiKey,
        wasenderPhoneNumber: effectivePhone || undefined,
        wasenderSessionStatus: sessionStatus,
        wasenderIsActive: isActive,
        wasenderQrString: qrString,
        wasenderQrGeneratedAt: qrString ? new Date() : null,
        channelStatus: isActive, // true if already connected
      },
    })

    logger.info('[Workspace] Wasender session initialized:', {
      workspaceId,
      sessionId,
      phoneNumber: this.maskPhoneNumber(effectivePhone),
      hasQr: !!qrString,
    })

    return workspace
  }

  /**
   * Disconnect Wasender session (pause — keeps session record on WasenderAPI).
   * Use this when customer wants to temporarily pause the WhatsApp channel.
   */
  async disconnectWasenderSession(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { wasenderSessionId: true, ownerId: true },
    })

    if (!workspace) throw new Error('Workspace not found')
    if (workspace.ownerId !== userId) throw new Error('Access denied')
    if (!workspace.wasenderSessionId) throw new Error('No Wasender session found')

    // Disconnect on WasenderAPI
    await this.wasenderClient.disconnectSession(workspace.wasenderSessionId)

    // Update database
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        wasenderSessionStatus: 'disconnected',
        wasenderIsActive: false,
        channelStatus: false,
      },
    })

    logger.info('[Workspace] Wasender session disconnected:', { workspaceId })
  }

  /**
   * Permanently delete Wasender session.
   * Call when switching provider or deleting workspace.
   */
  async deleteWasenderSession(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { wasenderSessionId: true, ownerId: true },
    })

    if (!workspace) throw new Error('Workspace not found')
    if (workspace.ownerId !== userId) throw new Error('Access denied')

    if (workspace.wasenderSessionId) {
      await this.wasenderClient.deleteSession(workspace.wasenderSessionId)
    }

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        wasenderSessionId: null,
        wasenderApiKey: null,
        wasenderPhoneNumber: null,
        wasenderSessionStatus: null,
        wasenderIsActive: false,
        wasenderQrString: null,
        wasenderQrGeneratedAt: null,
        channelStatus: false,
      },
    })

    logger.info('[Workspace] Wasender session deleted:', { workspaceId })
  }

  /**
   * Restart Wasender session (recover from stuck/disconnected state without re-scan).
   * Uses WasenderAPI POST /api/whatsapp-sessions/{id}/restart.
   */
  async restartWasenderSession(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { wasenderSessionId: true, ownerId: true },
    })

    if (!workspace) throw new Error('Workspace not found')
    if (workspace.ownerId !== userId) throw new Error('Access denied')
    if (!workspace.wasenderSessionId) throw new Error('No Wasender session found')

    await this.wasenderClient.restartSession(workspace.wasenderSessionId)

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { wasenderSessionStatus: 'need_scan' },
    })

    logger.info('[Workspace] Wasender session restarted:', { workspaceId })
  }

  /**
   * Sync Wasender session status from WasenderAPI → update DB.
   * Call this on settings page load to detect if session is already connected
   * without going through full initialization flow (no subscription check needed).
   *
   * Fixes: channelStatus stuck at false even when WasenderAPI session is connected.
   */
  async syncWasenderStatus(workspaceId: string): Promise<{
    wasenderSessionStatus: string | null
    wasenderIsActive: boolean
    wasenderQrString: string | null
  }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { wasenderSessionId: true },
    })

    if (!workspace?.wasenderSessionId) {
      // No session tracked in DB → try to discover existing sessions on WasenderAPI.
      // This handles: session created via dashboard, DB reset, previous init failure, etc.
      const adopted = await this.adoptExistingWasenderSession(workspaceId)
      if (adopted) {
        // Save adopted session to DB and set provider
        await this.prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            whatsappProvider: 'wasender',
            wasenderSessionId: adopted.sessionId,
            wasenderApiKey: adopted.apiKey,
          },
        })
        logger.info('[Workspace] Adopted existing Wasender session during sync:', {
          workspaceId,
          sessionId: adopted.sessionId,
        })
        // Re-sync with the now-tracked session
        return this.syncWasenderStatus(workspaceId)
      }
      return { wasenderSessionStatus: 'idle', wasenderIsActive: false, wasenderQrString: null }
    }

    try {
      const actualStatus = await this.wasenderClient.getSessionStatus(workspace.wasenderSessionId)
      const normalized = actualStatus.toLowerCase()
      const isConnected = normalized === 'connected'

      // When session is confirmed connected: also fix webhook URL automatically.
      // This avoids forcing the user to click "Connect WhatsApp" just to register the webhook.
      if (isConnected) {
        const webhookUrl = `${process.env.APP_WEBHOOK_BASE_URL}/api/v1/wasender/webhook/${workspaceId}`
        await this.wasenderClient.updateSessionWebhook(workspace.wasenderSessionId, webhookUrl)
      }

      const updated = await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          wasenderSessionStatus: normalized,
          wasenderIsActive: isConnected,
          channelStatus: isConnected,
          ...(isConnected ? { wasenderQrString: null, wasenderQrGeneratedAt: null } : {}),
        },
        select: {
          wasenderSessionStatus: true,
          wasenderIsActive: true,
          wasenderQrString: true,
        },
      })

      logger.info('[Workspace] Wasender status synced:', { workspaceId, status: normalized, isConnected })
      return updated
    } catch (error: any) {
      logger.warn('[Workspace] Wasender status sync failed (session may not exist):', { workspaceId, error: error.message })
      return { wasenderSessionStatus: 'disconnected', wasenderIsActive: false, wasenderQrString: null }
    }
  }

  /**
   * Regenerate Wasender QR code (previous QR expired after 45s).
   * Calls connectSession() again which returns a fresh QR string.
   */
  async regenerateWasenderQr(workspaceId: string, userId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        wasenderSessionId: true,
        wasenderSessionStatus: true,
        ownerId: true,
      },
    })

    if (!workspace) throw new Error('Workspace not found')
    if (workspace.ownerId !== userId) throw new Error('Access denied')
    if (!workspace.wasenderSessionId) throw new Error('No Wasender session found')
    if (workspace.wasenderSessionStatus === 'connected') {
      throw new Error('Session already connected')
    }

    // Get fresh QR
    const qrString = await this.wasenderClient.getQrCode(workspace.wasenderSessionId)

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        wasenderQrString: qrString,
        wasenderQrGeneratedAt: new Date(),
      },
    })

    logger.info('[Workspace] Wasender QR regenerated:', { workspaceId })
    return qrString
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Mask phone number for logging (PII protection)
   * @private
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return '***';
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 4);
  }
}
