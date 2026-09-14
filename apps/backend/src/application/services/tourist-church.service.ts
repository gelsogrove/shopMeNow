import { prisma } from "@echatbot/database"
import { TouristChurchEntity } from "../../domain/entities/tourist-church.entity"
import { TouristChurchRepository } from "../../repositories/tourist-church.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristChurch
 * Handles business logic for tourist churches
 */
export class TouristChurchService {
  private touristChurchRepository: any

  constructor() {
    this.touristChurchRepository = new TouristChurchRepository(prisma)
  }

  /**
   * Get all TouristChurchs for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<TouristChurchEntity[]> {
    try {
      return await this.touristChurchRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristChurchs:", error)
      throw error
    }
  }

  /**
   * Get a TouristChurch by ID
   */
  async getById(id: string, workspaceId: string): Promise<TouristChurchEntity | null> {
    try {
      return await this.touristChurchRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristChurch with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristChurch
   */
  async create(data: Partial<TouristChurchEntity>): Promise<TouristChurchEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const toCreate = new TouristChurchEntity(data)

      if (!toCreate.validate()) {
        throw new Error("Invalid TouristChurch data")
      }

      return await this.touristChurchRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristChurch:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristChurch
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristChurchEntity>
  ): Promise<TouristChurchEntity | null> {
    try {
      const existing = await this.touristChurchRepository.findById(id, workspaceId)
      if (!existing) {
        throw new Error("TouristChurch not found")
      }

      const toUpdate = new TouristChurchEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !toUpdate.validate()) {
        throw new Error("Invalid TouristChurch data")
      }

      return await this.touristChurchRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating TouristChurch with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristChurch
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const found = await this.touristChurchRepository.findById(id, workspaceId)
      if (!found) {
        throw new Error("TouristChurch not found")
      }

      return await this.touristChurchRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristChurch with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristChurchService()
