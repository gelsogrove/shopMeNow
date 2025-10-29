import { PrismaClient } from "@prisma/client"
import { FAQ } from "../../domain/entities/faq.entity"
import { FAQRepository } from "../../repositories/faq.repository"
import logger from "../../utils/logger"

const prisma = new PrismaClient()

/**
 * Service layer for FAQ
 * Handles business logic for FAQs
 */
export class FaqService {
  private faqRepository: any // Using FAQRepository instead of interface for now

  constructor() {
    this.faqRepository = new FAQRepository(prisma)
  }

  /**
   * Get all FAQs for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<FAQ[]> {
    try {
      return await this.faqRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all FAQs:", error)
      throw error
    }
  }

  /**
   * Get a FAQ by ID
   */
  async getById(id: string, workspaceId: string): Promise<FAQ | null> {
    try {
      return await this.faqRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting FAQ with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new FAQ
   */
  async create(data: Partial<FAQ>): Promise<FAQ> {
    try {
      // Validate required fields
      if (!data.question || !data.answer || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      // Create a FAQ entity for validation
      const faqToCreate = new FAQ(data)

      // Validate the FAQ
      if (!faqToCreate.validate()) {
        throw new Error("Invalid FAQ data")
      }

      // Create the FAQ
      return await this.faqRepository.create(data)
    } catch (error) {
      logger.error("Error creating FAQ:", error)
      throw error
    }
  }

  /**
   * Update an existing FAQ
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<FAQ>
  ): Promise<FAQ | null> {
    try {
      // Check if FAQ exists
      const existingFAQ = await this.faqRepository.findById(id, workspaceId)
      if (!existingFAQ) {
        throw new Error("FAQ not found")
      }

      // Create merged FAQ for validation
      const faqToUpdate = new FAQ({
        ...existingFAQ,
        ...data,
      })

      // Validate the FAQ if question or answer are updated
      if ((data.question || data.answer) && !faqToUpdate.validate()) {
        throw new Error("Invalid FAQ data")
      }

      // Update the FAQ
      return await this.faqRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating FAQ with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a FAQ
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      // Check if FAQ exists
      const faq = await this.faqRepository.findById(id, workspaceId)
      if (!faq) {
        throw new Error("FAQ not found")
      }

      // Delete the FAQ
      return await this.faqRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting FAQ with id ${id}:`, error)
      throw error
    }
  }
}

export default new FaqService()
