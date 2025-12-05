/**
 * FAQRepository
 *
 * Repository for managing FAQ (Frequently Asked Questions) knowledge base.
 * Provides keyword-based search for FAQ matching in the Router Agent.
 *
 * Key Methods:
 * - searchByKeywords: Intelligent FAQ matching using PostgreSQL text search
 * - findByCategory: Get FAQs filtered by category
 * - findActiveByOrder: Get all active FAQs sorted by priority
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { FAQ, PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"

export class FAQRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Search FAQs by keywords (intelligent matching)
   *
   * Strategy:
   * 1. Check if ANY keyword in FAQ matches user query (case-insensitive)
   * 2. Order by relevance (more keyword matches = higher priority)
   * 3. Return top N results
   *
   * @param workspaceId - Workspace ID (security filter)
   * @param searchQuery - User query string
   * @param limit - Maximum number of results (default: 5)
   * @returns Array of matching FAQs sorted by relevance
   */
  async searchByKeywords(
    workspaceId: string,
    searchQuery: string,
    limit: number = 5
  ): Promise<FAQ[]> {
    try {
      const queryLower = searchQuery.toLowerCase()

      // Get all active FAQs for workspace
      const allFAQs = await this.prisma.fAQ.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc", // Respect manual priority ordering
        },
      })

      // Calculate relevance score for each FAQ
      const scoredFAQs = allFAQs.map((faq) => {
        let score = 0

        // Check keywords array
        if (faq.keywords && Array.isArray(faq.keywords)) {
          for (const keyword of faq.keywords) {
            const keywordLower = keyword.toLowerCase()

            // Exact match in query (high score)
            if (queryLower.includes(keywordLower)) {
              score += 10
            }

            // Partial match (lower score)
            const words = queryLower.split(/\s+/)
            for (const word of words) {
              if (keywordLower.includes(word) || word.includes(keywordLower)) {
                score += 3
              }
            }
          }
        }

        // Check question text for matches
        const questionLower = faq.question.toLowerCase()
        const questionWords = queryLower.split(/\s+/)
        for (const word of questionWords) {
          if (questionLower.includes(word) && word.length > 3) {
            score += 1
          }
        }

        return { faq, score }
      })

      // Filter FAQs with score > 0 and sort by score
      const matchedFAQs = scoredFAQs
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.faq)

      logger.info(
        `FAQ search for "${searchQuery}": found ${matchedFAQs.length} matches (workspace: ${workspaceId})`
      )

      return matchedFAQs
    } catch (error) {
      logger.error("Error searching FAQs by keywords:", error)
      throw error
    }
  }

  /**
   * Find FAQs by category
   * @param workspaceId - Workspace ID (security filter)
   * @param category - FAQ category (e.g., "Ordini", "Spedizioni")
   * @returns Array of FAQs in the category
   */
  async findByCategory(workspaceId: string, category: string): Promise<FAQ[]> {
    try {
      return await this.prisma.fAQ.findMany({
        where: {
          workspaceId,
          category,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error(`Error finding FAQs by category ${category}:`, error)
      throw error
    }
  }

  /**
   * Find all active FAQs sorted by order (priority)
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active FAQs sorted by order field
   */
  async findActiveByOrder(workspaceId: string): Promise<FAQ[]> {
    try {
      return await this.prisma.fAQ.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding active FAQs by order:", error)
      throw error
    }
  }

  /**
   * Find FAQ by ID
   * @param id - FAQ ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns FAQ or null
   */
  async findById(id: string, workspaceId: string): Promise<FAQ | null> {
    try {
      return await this.prisma.fAQ.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding FAQ by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all FAQs for a workspace (including inactive)
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of all FAQs
   */
  async findAll(workspaceId: string): Promise<FAQ[]> {
    try {
      return await this.prisma.fAQ.findMany({
        where: {
          workspaceId,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all FAQs:", error)
      throw error
    }
  }

  /**
   * Get FAQ categories with counts
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of categories with FAQ counts
   */
  async getCategoriesWithCount(workspaceId: string): Promise<
    Array<{
      category: string | null
      count: number
    }>
  > {
    try {
      const result = await this.prisma.fAQ.groupBy({
        by: ["category"],
        where: {
          workspaceId,
          isActive: true,
        },
        _count: {
          id: true,
        },
      })

      return result.map((item) => ({
        category: item.category,
        count: item._count.id,
      }))
    } catch (error) {
      logger.error("Error getting FAQ categories with count:", error)
      throw error
    }
  }

  /**
   * Create new FAQ
   * @param data - FAQ data
   * @returns Created FAQ
   */
  async create(data: {
    workspaceId: string
    question: string
    answer: string
    keywords?: string[]
    category?: string
    order?: number
    isActive?: boolean
  }): Promise<FAQ> {
    try {
      const faq = await this.prisma.fAQ.create({
        data: {
          workspaceId: data.workspaceId,
          question: data.question,
          answer: data.answer,
          keywords: data.keywords || [],
          category: data.category,
          order: data.order ?? 999, // Default to low priority
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created FAQ "${faq.question}" for workspace ${data.workspaceId}`
      )
      return faq
    } catch (error) {
      logger.error("Error creating FAQ:", error)
      throw error
    }
  }

  /**
   * Update FAQ
   * @param id - FAQ ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated FAQ
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      question: string
      answer: string
      keywords: string[]
      category: string
      order: number
      isActive: boolean
    }>
  ): Promise<FAQ> {
    try {
      const faq = await this.prisma.fAQ.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (faq.count === 0) {
        throw new Error(`FAQ ${id} not found in workspace ${workspaceId}`)
      }

      logger.info(`Updated FAQ ${id} for workspace ${workspaceId}`)

      // Return updated FAQ
      const updatedFAQ = await this.findById(id, workspaceId)
      if (!updatedFAQ) {
        throw new Error(`Failed to retrieve updated FAQ ${id}`)
      }

      return updatedFAQ
    } catch (error) {
      logger.error(`Error updating FAQ ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete FAQ (soft delete: set isActive = false)
   * @param id - FAQ ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted FAQ
   */
  async softDelete(id: string, workspaceId: string): Promise<FAQ> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting FAQ ${id}:`, error)
      throw error
    }
  }

  /**
   * Hard delete FAQ (permanent removal)
   * @param id - FAQ ID
   * @param workspaceId - Workspace ID (security filter)
   */
  async hardDelete(id: string, workspaceId: string): Promise<void> {
    try {
      await this.prisma.fAQ.deleteMany({
        where: {
          id,
          workspaceId,
        },
      })

      logger.info(`Hard deleted FAQ ${id} from workspace ${workspaceId}`)
    } catch (error) {
      logger.error(`Error hard deleting FAQ ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete FAQ (alias for softDelete to match interface)
   * @param id - FAQ ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns true if deleted successfully
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      await this.softDelete(id, workspaceId)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Count active FAQs for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active FAQs
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.fAQ.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active FAQs:", error)
      throw error
    }
  }
}
