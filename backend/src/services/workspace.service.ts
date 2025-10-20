import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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
  challengeStatus?: boolean
  wipMessages?: any // multilingua
  blocklist?: string
  url?: string
  welcomeMessages?: any
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
  challengeStatus?: boolean
  wipMessages?: any // multilingua
  blocklist?: string
  url?: string
  welcomeMessages?: any
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
        challengeStatus: true,
        wipMessages: true,
        blocklist: true,
        url: true,
        welcomeMessages: true,
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
        challengeStatus: true,
        wipMessages: true,
        blocklist: true,
        url: true,
        welcomeMessages: true,
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
        prompt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    })

    // 🚨 CRITICAL DEBUG: Log what we found
    console.log(
      `🔍 WORKSPACE.SERVICE: Loading AgentConfigs for workspace ${id}`
    )
    console.log(`📋 Found ${agentConfigs.length} active AgentConfigs:`)
    agentConfigs.forEach((config, index) => {
      console.log(
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
        challengeStatus: true,
        wipMessages: true,
        blocklist: true,
        url: true,
        welcomeMessages: true,
      },
    })
  },

  async update(id: string, data: UpdateWorkspaceData) {
    // Separate adminEmail from the rest of the data
    const { adminEmail, ...workspaceData } = data as UpdateWorkspaceData & {
      adminEmail?: string
    }

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
        challengeStatus: true,
        wipMessages: true,
        blocklist: true,
        url: true,
        welcomeMessages: true,
      },
    })

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
    return prisma.workspace.update({
      where: { id },
      data: { isDelete: true },
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
    return agentConfig?.prompt || null
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
