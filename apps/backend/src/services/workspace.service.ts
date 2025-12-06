import { prisma } from "@echatbot/database"
import logger from "../utils/logger"

// prisma imported

interface CreateWorkspaceData {
  name: string
  slug: string
  description?: string
  whatsappPhoneNumber?: string
  whatsappApiKey?: string
  isDelete?: boolean
  isActive?: boolean
  currency?: string
  language?: string
  messageLimit?: number
  channelStatus?: boolean
  wipMessage?: string // English only
  blocklist?: string
  url?: string
  welcomeMessage?: string // English only
}

interface UpdateWorkspaceData {
  name?: string
  slug?: string
  description?: string
  whatsappPhoneNumber?: string
  whatsappApiKey?: string
  isActive?: boolean
  isDelete?: boolean
  currency?: string
  language?: string
  messageLimit?: number
  channelStatus?: boolean
  wipMessage?: string // English only
  blocklist?: string
  url?: string
  welcomeMessage?: string // English only
  allowedExternalLinks?: string[] // 🛡️ Security: allowed domains for external links
}

export const workspaceService = {
  async getAll() {
    return prisma.workspace.findMany({
      where: {
        isDelete: false,
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
        isActive: true,
        isDelete: true,
        currency: true,
        language: true,
        messageLimit: true,
        channelStatus: true,
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        welcomeMessage: true,
        allowedExternalLinks: true, // 🛡️ Security
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
        createdAt: true,
        updatedAt: true,
        isActive: true,
        isDelete: true,
        currency: true,
        language: true,
        messageLimit: true,
        channelStatus: true,
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        welcomeMessage: true,
        allowedExternalLinks: true, // 🛡️ Security
      },
    })

    if (!workspace) return null

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
    return prisma.workspace.create({
      data: {
        ...data,
        slug: data.name.toLowerCase().replace(/\s+/g, "-"),
        isDelete: false,
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
        isActive: true,
        isDelete: true,
        currency: true,
        language: true,
        messageLimit: true,
        channelStatus: true,
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        welcomeMessage: true,
      },
    })
  },

  async update(id: string, data: UpdateWorkspaceData) {
    // Separate fields that shouldn't go to Prisma directly
    const { 
      adminEmail, 
      challengeStatus,
      id: _id,  // Remove id if present (shouldn't update primary key)
      ...workspaceData 
    } = data as UpdateWorkspaceData & {
      adminEmail?: string
      challengeStatus?: boolean  // Frontend sends challengeStatus, but DB uses channelStatus
      id?: string  // Frontend might send id but we shouldn't update it
    }

    // 🔄 Map challengeStatus → channelStatus (frontend uses different name than DB)
    if (challengeStatus !== undefined) {
      (workspaceData as any).channelStatus = challengeStatus
    }

    // 🔍 LOG DETTAGLIATO per debug
    logger.info("=== WORKSPACE UPDATE DEBUG ===")
    logger.info("Workspace ID:", id)
    logger.info("Data received:", JSON.stringify(data, null, 2))
    logger.info("challengeStatus from frontend:", challengeStatus)
    logger.info("channelStatus mapped to:", (workspaceData as any).channelStatus)
    logger.info(
      "whatsappApiKey in data:",
      data.whatsappApiKey ? "✅ PRESENTE" : "❌ ASSENTE"
    )
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
        isActive: true,
        isDelete: true,
        currency: true,
        language: true,
        messageLimit: true,
        channelStatus: true,
        wipMessage: true,
        // blocklist: true, // REMOVED: field no longer exists
        url: true,
        welcomeMessage: true,
        allowedExternalLinks: true, // 🛡️ Security
      },
    })

    // 🔍 LOG RISULTATO UPDATE
    logger.info("=== WORKSPACE AFTER UPDATE ===")
    logger.info(
      "Updated whatsappApiKey:",
      updatedWorkspace.whatsappApiKey ? "✅ SALVATA" : "❌ NULL"
    )
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
        isDelete: true,  // Legacy flag (keep for backward compatibility)
        deletedAt: new Date(),  // New soft-delete timestamp
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
