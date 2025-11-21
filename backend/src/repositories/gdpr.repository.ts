import { prisma } from "../lib/prisma"
import logger from "../utils/logger"

/**
 * Repository for GDPR Content management
 * Simple structure: One row per workspace with all 4 languages in separate columns
 */
export class GdprRepository {
  /**
   * Get GDPR content for a workspace (all 4 languages)
   */
  async getGdprContent(workspaceId: string) {
    try {
      logger.info(`[GDPR REPO] Getting GDPR content for workspace: ${workspaceId}`)

      const gdprContent = await prisma.gdprContent.findUnique({
        where: { workspaceId }
      })

      if (!gdprContent) {
        logger.warn(`[GDPR REPO] No GDPR content found for workspace: ${workspaceId}`)
        return null
      }

      return gdprContent
    } catch (error) {
      logger.error(`[GDPR REPO] Error getting GDPR content: ${error.message}`)
      throw error
    }
  }
  
  /**
   * Update or create GDPR content for a workspace
   */
  async updateGdprContent(
    workspaceId: string,
    data: {
      gdpr_ita: string
      gdpr_esp: string
      gdpr_eng: string
      gdpr_prt: string
    }
  ): Promise<any> {
    try {
      logger.info(`[GDPR REPO] Updating GDPR content for workspace: ${workspaceId}`)

      // Try to find existing record
      const existing = await prisma.gdprContent.findUnique({
        where: { workspaceId }
      })

      let gdprRecord

      if (existing) {
        // Update existing record
        gdprRecord = await prisma.gdprContent.update({
          where: { workspaceId },
          data: {
            ...data,
            updatedAt: new Date()
          }
        })
        logger.info(`[GDPR REPO] GDPR content updated for workspace: ${workspaceId}`)
      } else {
        // Create new record
        gdprRecord = await prisma.gdprContent.create({
          data: {
            workspaceId,
            ...data
          }
        })
        logger.info(`[GDPR REPO] GDPR content created for workspace: ${workspaceId}`)
      }

      return gdprRecord
    } catch (error) {
      logger.error(`[GDPR REPO] Error updating GDPR content: ${error.message}`)
      throw error
    }
  }
}

export const gdprRepository = new GdprRepository()
