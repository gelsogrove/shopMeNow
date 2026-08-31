import { prisma } from "@echatbot/database"
import { TouristExcursionEntity } from "../../domain/entities/tourist-excursion.entity"
import { TouristExcursionRepository } from "../../repositories/tourist-excursion.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristExcursion
 * Handles business logic for tourist excursion recommendations
 */
export class TouristExcursionService {
  private touristExcursionRepository: any

  constructor() {
    this.touristExcursionRepository = new TouristExcursionRepository(prisma)
  }

  /**
   * Get all TouristExcursions for a workspace
   */
  async getAllForWorkspace(
    workspaceId: string
  ): Promise<TouristExcursionEntity[]> {
    try {
      return await this.touristExcursionRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristExcursions:", error)
      throw error
    }
  }

  /**
   * Get a TouristExcursion by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<TouristExcursionEntity | null> {
    try {
      return await this.touristExcursionRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristExcursion with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristExcursion
   */
  async create(
    data: Partial<TouristExcursionEntity>
  ): Promise<TouristExcursionEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const touristExcursionToCreate = new TouristExcursionEntity(data)

      if (!touristExcursionToCreate.validate()) {
        throw new Error("Invalid TouristExcursion data")
      }

      return await this.touristExcursionRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristExcursion:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristExcursion
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristExcursionEntity>
  ): Promise<TouristExcursionEntity | null> {
    try {
      const existing = await this.touristExcursionRepository.findById(
        id,
        workspaceId
      )
      if (!existing) {
        throw new Error("TouristExcursion not found")
      }

      const touristExcursionToUpdate = new TouristExcursionEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !touristExcursionToUpdate.validate()) {
        throw new Error("Invalid TouristExcursion data")
      }

      return await this.touristExcursionRepository.update(
        id,
        workspaceId,
        data
      )
    } catch (error) {
      logger.error(`Error updating TouristExcursion with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristExcursion
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const touristExcursion = await this.touristExcursionRepository.findById(
        id,
        workspaceId
      )
      if (!touristExcursion) {
        throw new Error("TouristExcursion not found")
      }

      return await this.touristExcursionRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristExcursion with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristExcursionService()
