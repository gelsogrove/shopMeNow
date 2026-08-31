import { prisma } from "@echatbot/database"
import { TouristRefugeEntity } from "../../domain/entities/tourist-refuge.entity"
import { TouristRefugeRepository } from "../../repositories/tourist-refuge.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristRefuge
 * Handles business logic for tourist mountain refuge recommendations
 */
export class TouristRefugeService {
  private touristRefugeRepository: any

  constructor() {
    this.touristRefugeRepository = new TouristRefugeRepository(prisma)
  }

  /**
   * Get all TouristRefuges for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<TouristRefugeEntity[]> {
    try {
      return await this.touristRefugeRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristRefuges:", error)
      throw error
    }
  }

  /**
   * Get a TouristRefuge by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<TouristRefugeEntity | null> {
    try {
      return await this.touristRefugeRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristRefuge with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristRefuge
   */
  async create(
    data: Partial<TouristRefugeEntity>
  ): Promise<TouristRefugeEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const touristRefugeToCreate = new TouristRefugeEntity(data)

      if (!touristRefugeToCreate.validate()) {
        throw new Error("Invalid TouristRefuge data")
      }

      return await this.touristRefugeRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristRefuge:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristRefuge
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristRefugeEntity>
  ): Promise<TouristRefugeEntity | null> {
    try {
      const existing = await this.touristRefugeRepository.findById(
        id,
        workspaceId
      )
      if (!existing) {
        throw new Error("TouristRefuge not found")
      }

      const touristRefugeToUpdate = new TouristRefugeEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !touristRefugeToUpdate.validate()) {
        throw new Error("Invalid TouristRefuge data")
      }

      return await this.touristRefugeRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating TouristRefuge with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristRefuge
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const touristRefuge = await this.touristRefugeRepository.findById(
        id,
        workspaceId
      )
      if (!touristRefuge) {
        throw new Error("TouristRefuge not found")
      }

      return await this.touristRefugeRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristRefuge with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristRefugeService()
