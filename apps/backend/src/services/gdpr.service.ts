import logger from "../utils/logger"
import { gdprRepository } from "../repositories/gdpr.repository"

export interface GdprContent {
  gdpr_ita: string
  gdpr_esp: string
  gdpr_eng: string
  gdpr_prt: string
}

export class GdprService {
  /**
   * Get GDPR content for a workspace (all 4 languages)
   */
  async getGdprContent(workspaceId: string): Promise<GdprContent | null> {
    try {
      logger.info(`[GdprService] Getting GDPR content for workspace: ${workspaceId}`)
      const content = await gdprRepository.getGdprContent(workspaceId)
      return content
    } catch (error) {
      logger.error(`[GdprService] Error getting GDPR content:`, error)
      throw new Error(`Failed to get GDPR content: ${(error as Error).message}`)
    }
  }

  /**
   * Update GDPR content for a workspace (all 4 languages)
   */
  async updateGdprContent(
    workspaceId: string,
    data: GdprContent
  ): Promise<any> {
    try {
      logger.info(`[GdprService] Updating GDPR content for workspace: ${workspaceId}`)
      const result = await gdprRepository.updateGdprContent(workspaceId, data)
      logger.info(`[GdprService] GDPR content updated successfully`)
      return result
    } catch (error) {
      logger.error(`[GdprService] Error updating GDPR content:`, error)
      throw new Error(`Failed to update GDPR content: ${(error as Error).message}`)
    }
  }
}

export const gdprService = new GdprService()
