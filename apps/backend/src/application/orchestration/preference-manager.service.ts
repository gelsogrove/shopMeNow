import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { PreferenceEntry } from "./types"

/**
 * Manages conversational preferences with confidence/expiry metadata.
 * Current version keeps a JSON blob on customer row if available, otherwise
 * acts as an in-memory passthrough.
 */
export class PreferenceManagerService {
  constructor(private prisma: PrismaClient) {}

  async load(params: { conversationId: string; workspaceId: string }): Promise<PreferenceEntry[]> {
    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: params.conversationId },
        select: { context: true, workspaceId: true },
      })

      if (!session || session.workspaceId !== params.workspaceId) {
        return []
      }

      const prefs = (session.context as any)?.preferences || []
      return Array.isArray(prefs) ? prefs : []
    } catch (error) {
      logger.error("[Preferences] Failed to load preferences", { error })
      return []
    }
  }

  async save(params: { conversationId: string; workspaceId: string; preferences: PreferenceEntry[] }): Promise<void> {
    try {
      const existing = await this.prisma.chatSession.findUnique({
        where: { id: params.conversationId },
        select: { context: true, workspaceId: true },
      })

      if (!existing || existing.workspaceId !== params.workspaceId) {
        return
      }

      const nextContext = {
        ...(existing.context as any),
        preferences: params.preferences,
      }

      await this.prisma.chatSession.update({
        where: { id: params.conversationId },
        data: { context: nextContext },
      })
    } catch (error) {
      logger.error("[Preferences] Failed to save preferences", { error })
    }
  }
}
