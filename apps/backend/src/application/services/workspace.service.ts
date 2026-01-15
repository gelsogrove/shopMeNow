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
import { defaultAgents } from "../../../prisma/data/defaultAgents"
import { initialFAQs } from "../../../prisma/data/initialFAQs"

export class WorkspaceService {
  private repository: WorkspaceRepositoryInterface
  private prisma: PrismaClient

  constructor(prismaInstance?: PrismaClient) {
    this.prisma = prismaInstance || prisma
    this.repository = new WorkspaceRepository(this.prisma)
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
        users: {
          some: {
            userId: userId
          }
        },
        deletedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Convert to Workspace entities
    return workspaces.map(w => new Workspace({
      id: w.id,
      name: w.name,
      slug: w.slug,
      description: w.description ?? undefined,
      whatsappPhoneNumber: w.whatsappPhoneNumber ?? undefined,
      whatsappApiKey: w.whatsappApiKey ?? undefined,
      whatsappPhoneNumberId: (w as any).whatsappPhoneNumberId ?? undefined,
      whatsappVerifyToken: (w as any).whatsappVerifyToken ?? undefined,
      webhookUrl: w.webhookUrl ?? undefined,
      notificationEmail: w.notificationEmail ?? undefined,
      language: w.language ?? 'it',
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
      planType: w.planType ?? undefined,
      trialEndsAt: w.trialEndsAt ?? undefined,
      // 🆕 Channel Configuration (Feature 199) - CRITICAL: Must include these!
      enableWhatsapp: (w as any).enableWhatsapp ?? true,
      enableWidget: (w as any).enableWidget ?? false,
      sellsProductsAndServices: w.sellsProductsAndServices,
      hasSalesAgents: w.hasSalesAgents,
      hasHumanSupport: w.hasHumanSupport,
      humanSupportInstructions: w.humanSupportInstructions ?? undefined,
      operatorContactMethod: w.operatorContactMethod ?? undefined,
      operatorWhatsappNumber: w.operatorWhatsappNumber ?? undefined,
      toneOfVoice: w.toneOfVoice ?? undefined,
      botIdentityResponse: w.botIdentityResponse ?? undefined,
      address: w.address ?? undefined,
      customAiRules: w.customAiRules ?? undefined,
      // 🆕 Logo
      logoUrl: w.logoUrl ?? undefined,
      // 🆕 Widget Configuration
      widgetTitle: (w as any).widgetTitle ?? undefined,
      widgetLanguage: (w as any).widgetLanguage ?? undefined,
      widgetPrimaryColor: (w as any).widgetPrimaryColor ?? undefined,
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

    // 🆕 DEFAULT WELCOME AND WIP MESSAGES
    const defaultWelcomeMessage = {
      en: "Welcome! I'm SofiA, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?",
      es: "¡Bienvenido! Soy SofiA, tu asistente digital. Puedo ayudarte a descubrir productos gourmet italianos, responder preguntas y gestionar pedidos. ¿Cómo puedo ayudarte hoy?",
      it: "Benvenuto! Sono SofiA, il tuo assistente digitale. Posso aiutarti a scoprire prodotti gourmet italiani, rispondere alle tue domande e gestire ordini. Come posso aiutarti oggi?",
      pt: "Bem-vindo! Sou a SofiA, a sua assistente digital. Posso ajudá-lo a descobrir produtos gourmet italianos, responder perguntas e gerir encomendas. Como posso ajudá-lo hoje?",
    }

    const defaultWipMessage = {
      en: "Work in progress. Please contact us later.",
      es: "Trabajos en curso. Por favor, contáctenos más tarde.",
      it: "Lavori in corso. Contattaci più tardi.",
      pt: "Em manutenção. Por favor, contacte-nos mais tarde.",
    }

    // Add messages to workspace data
    data.welcomeMessage = defaultWelcomeMessage
    data.wipMessage = defaultWipMessage

    // 🆕 Feature 199: Set default channel configuration values
    // These can be overridden by wizard input, but provide sensible defaults
    if (data.hasHumanSupport === undefined) data.hasHumanSupport = true
    if (data.hasSalesAgents === undefined) data.hasSalesAgents = false
    if (data.sellsProductsAndServices === undefined) data.sellsProductsAndServices = true
    if (data.toneOfVoice === undefined) data.toneOfVoice = "FRIENDLY"
    if (data.operatorContactMethod === undefined) data.operatorContactMethod = "EMAIL"
    
    // Default human support instructions - use placeholder as default
    if (!data.humanSupportInstructions) {
      if (data.hasHumanSupport) {
        if (data.hasSalesAgents) {
          data.humanSupportInstructions =
            `Ciao {{nameUser}}, mi sto mettendo in contatto con l'agente {{agentName}}.\nTi richiamera' al piu' presto (tel: {{agentPhone}} - email: {{agentEmail}}).\nMetto in pausa il chatbot finche' non ricevi risposta.`
        } else {
          data.humanSupportInstructions =
            `Ciao {{nameUser}}, mi sto mettendo in contatto con il nostro operatore.\nTi rispondera' al piu' presto.\nMetto in pausa il chatbot finche' non ricevi assistenza.`
        }
      } else {
        data.humanSupportInstructions =
          "Mi dispiace per il disagio. Puoi inviarci una mail a {{adminEmail}} e ti risponderemo il prima possibile."
      }
    }
    
    // Default bot identity
    if (!data.botIdentityResponse) {
      data.botIdentityResponse = "I'm your digital assistant. I can help you find products, answer questions, and manage your orders!"
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
      try {
        const agents = defaultAgents(createdWorkspace.id)
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
              : 19.00 // Fallback to €19 if not found
            
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
    
    // 🔍 DEBUG: Log chatbotName specifically
    if (data.chatbotName !== undefined) {
      logger.info(`🤖 chatbotName in update data: "${data.chatbotName}"`)
    }

    // 🆕 Feature 199: Auto-toggle e-commerce agents based on sellsProductsAndServices
    const ecommerceAgentTypes = ["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING"]
    
    if (data.sellsProductsAndServices === false) {
      logger.info(`⚠️ sellsProductsAndServices = false → Disabling e-commerce agents`)
      
      for (const agentType of ecommerceAgentTypes) {
        try {
          await this.repository.updateAgentStatus(id, agentType, false)
          logger.info(`✅ Disabled ${agentType} agent for workspace ${id}`)
        } catch (error) {
          logger.warn(`⚠️ Failed to disable ${agentType} agent:`, error)
        }
      }
    } else if (data.sellsProductsAndServices === true) {
      logger.info(`✅ sellsProductsAndServices = true → Enabling e-commerce agents`)
      
      for (const agentType of ecommerceAgentTypes) {
        try {
          await this.repository.updateAgentStatus(id, agentType, true)
          logger.info(`✅ Enabled ${agentType} agent for workspace ${id}`)
        } catch (error) {
          logger.warn(`⚠️ Failed to enable ${agentType} agent:`, error)
        }
      }
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

    return this.repository.update(id, data)
  }

  /**
   * Delete a workspace
   */
  async delete(id: string): Promise<boolean> {
    logger.info(`Deleting workspace with ID: ${id}`)
    return this.repository.delete(id)
  }

  /**
   * Get workspaces for a user
   */
  async getWorkspacesForUser(userId: string): Promise<Workspace[]> {
    logger.info(`Getting workspaces for user: ${userId}`)
    return this.repository.findByUserId(userId)
  }
}
