/**
 * MessageWorkspaceRepository - Workspace settings, system messages, agent config
 *
 * Extracted from MessageRepository (God class split).
 * Contains methods for workspace validation, settings retrieval,
 * and system message templates (WIP, welcome, welcome-back, error).
 *
 * @architecture Clean Architecture - Repository Layer
 */
import {
  prisma,
  PrismaClient,
} from "@echatbot/database"
import logger from "../utils/logger"

export class MessageWorkspaceRepository {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  /**
   * Validate a workspace ID
   * @param workspaceId The workspace ID to validate
   * @returns True if valid, False otherwise
   */
  async validateWorkspaceId(workspaceId: string): Promise<boolean> {
    try {
      if (!workspaceId || typeof workspaceId !== "string") {
        logger.warn("Invalid workspace ID format")
        return false
      }

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      })

      return !!workspace
    } catch (error) {
      logger.error("Error validating workspace ID:", error)
      return false
    }
  }

  /**
   * Get workspace settings for a workspace
   * @param workspaceId The workspace ID
   * @returns Workspace settings
   */
  async getWorkspaceSettings(workspaceId: string) {
    try {
      logger.info(`Getting workspace settings for workspace ${workspaceId}`)

      // Check if workspaceId is missing or empty
      if (!workspaceId || workspaceId.trim() === "") {
        logger.warn(
          "getWorkspaceSettings: No workspace ID provided, trying to find default workspace"
        )

        // Try to find any active workspace
        const activeWorkspace = await this.prisma.workspace.findFirst({
          where: { deletedAt: null },
        })

        if (activeWorkspace) {
          logger.info(
            `getWorkspaceSettings: Found active workspace ${activeWorkspace.id} to use as default`
          )
          return activeWorkspace
        }

        // If no active workspace, try any workspace
        const anyWorkspace = await this.prisma.workspace.findFirst()
        if (anyWorkspace) {
          logger.warn(
            `getWorkspaceSettings: No active workspaces found, using ${anyWorkspace.id} (inactive)`
          )
          return anyWorkspace
        }

        logger.error(
          "getWorkspaceSettings: No workspaces found in the database"
        )
        return null
      }

      // Try to find by exact ID first
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      })

      // If found, return it
      if (workspace) {
        logger.info(
          `getWorkspaceSettings: Workspace ${workspaceId} found, deletedAt: ${workspace.deletedAt}`
        )
        return workspace
      }

      // If not found by ID, try searching by name or slug
      logger.warn(
        `getWorkspaceSettings: Workspace with ID ${workspaceId} not found, trying alternative searches`
      )

      // Try by name or slug
      const workspaceByName = await this.prisma.workspace.findFirst({
        where: {
          OR: [
            { name: { contains: workspaceId, mode: "insensitive" } },
            { slug: { contains: workspaceId, mode: "insensitive" } },
          ],
        },
      })

      if (workspaceByName) {
        logger.info(
          `getWorkspaceSettings: Found workspace by name/slug match: ${workspaceByName.id}`
        )
        return workspaceByName
      }

      // If still not found, try to get any active workspace
      logger.warn(
        "getWorkspaceSettings: No matching workspace found, falling back to any active workspace"
      )

      const fallbackWorkspace = await this.prisma.workspace.findFirst({
        where: { deletedAt: null },
      })

      if (fallbackWorkspace) {
        logger.info(
          `getWorkspaceSettings: Using fallback active workspace: ${fallbackWorkspace.id}`
        )
        return fallbackWorkspace
      }

      logger.error(
        "getWorkspaceSettings: No workspaces found after all fallback attempts"
      )
      return null
    } catch (error) {
      logger.error(
        `Error getting workspace settings for ${workspaceId}:`,
        error
      )
      return null
    }
  }

  /**
   * Get workspace URL for registration links
   */
  async getWorkspaceUrl(workspaceId: string): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { url: true },
      })

      if (!workspace?.url) {
        logger.warn(`No URL found for workspace ${workspaceId}, using default`)
        return "http://localhost:3000"
      }

      return workspace.url
    } catch (error) {
      logger.error("Error getting workspace URL:", error)
      return "http://localhost:3000"
    }
  }

  /**
   * Get WIP message from database - NO HARDCODE (English only)
   * @param workspaceId Workspace ID
   * @returns WIP message from database (will be translated by Translation Layer)
   */
  async getWipMessage(workspaceId: string): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { wipMessage: true },
      })

      if (!workspace?.wipMessage) {
        logger.error(
          `❌ NO WIP MESSAGE in database for workspace ${workspaceId} - THIS SHOULD NOT HAPPEN`
        )
        throw new Error("WIP message not configured in database")
      }

      return workspace.wipMessage
    } catch (error) {
      logger.error(
        `Error getting WIP message for workspace ${workspaceId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Get welcome message from database - NO HARDCODE (English only)
   * @param workspaceId Workspace ID
   * @returns Welcome message from database (will be translated by Translation Layer)
   */
  async getWelcomeMessage(workspaceId: string): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { welcomeMessage: true },
      })

      if (!workspace?.welcomeMessage) {
        logger.error(
          `❌ NO WELCOME MESSAGE in database for workspace ${workspaceId} - THIS SHOULD NOT HAPPEN`
        )
        throw new Error("Welcome message not configured in database")
      }

      return typeof workspace.welcomeMessage === 'string' 
        ? workspace.welcomeMessage 
        : JSON.stringify(workspace.welcomeMessage)
    } catch (error) {
      logger.error(
        `Error getting welcome message for workspace ${workspaceId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Get welcome back message from database - NO HARDCODE
   * Uses afterRegistrationMessages as welcome back messages
   * @param workspaceId Workspace ID
   * @param customerName Customer name
   * @param language Customer language
   * @returns Welcome back message from database
   */
  async getWelcomeBackMessage(
    workspaceId: string,
    customerName: string,
    language: string
  ): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { afterRegistrationMessages: true },
      })

      if (!workspace?.afterRegistrationMessages) {
        logger.warn(
          `No after registration messages found for workspace ${workspaceId}`
        )
        return `Welcome back, ${customerName}! How can I help you today?`
      }

      const template = typeof workspace.afterRegistrationMessages === 'string'
        ? workspace.afterRegistrationMessages
        : JSON.stringify(workspace.afterRegistrationMessages)

      return template
        .replace("{name}", customerName)
        .replace("{customerName}", customerName)
        .replace("{{customerName}}", customerName)
        .replace("[nome]", customerName)
    } catch (error) {
      logger.error(
        `Error getting welcome back message for workspace ${workspaceId}:`,
        error
      )
      return `Welcome back, ${customerName}! How can I help you today?`
    }
  }

  /**
   * Get error message from database - NO HARDCODE (English only)
   * Uses wipMessage as fallback for error messages
   * @param workspaceId Workspace ID
   * @returns Error message from database (will be translated by Translation Layer)
   */
  async getErrorMessage(workspaceId: string): Promise<string> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { wipMessage: true },
      })

      if (!workspace?.wipMessage) {
        logger.error(
          `❌ NO WIP MESSAGE in database for workspace ${workspaceId} - THIS SHOULD NOT HAPPEN`
        )
        throw new Error("Error message not configured in database")
      }

      return workspace.wipMessage
    } catch (error) {
      logger.error(
        `Error getting error message for workspace ${workspaceId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Get agent configuration from database - NO HARDCODE
   * @param workspaceId Workspace ID
   * @returns Agent configuration from database
   */
  async getAgentConfig(workspaceId: string): Promise<{
    prompt: string
    model: string
    temperature: number
    maxTokens: number
  } | null> {
    try {
      const agentConfig = await this.prisma.agentConfig.findFirst({
        where: {
          workspaceId: workspaceId,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      if (!agentConfig) {
        return null
      }

      return {
        prompt: agentConfig.systemPrompt || "",
        model: agentConfig.model || "openai/gpt-4o-mini",
        temperature: agentConfig.temperature || 0.0,
        maxTokens: agentConfig.maxTokens || 5000,
      }
    } catch (error) {
      logger.error(
        `Error getting agent config for workspace ${workspaceId}:`,
        error
      )
      return null
    }
  }
}
