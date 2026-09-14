import { prisma } from "@echatbot/database"
import { TouristCastleEntity } from "../../domain/entities/tourist-castle.entity"
import { TouristCastleRepository } from "../../repositories/tourist-castle.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristCastle
 * Handles business logic for tourist castles
 */
export class TouristCastleService {
  private touristCastleRepository: any

  constructor() {
    this.touristCastleRepository = new TouristCastleRepository(prisma)
  }

  /**
   * Get all TouristCastles for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<TouristCastleEntity[]> {
    try {
      return await this.touristCastleRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristCastles:", error)
      throw error
    }
  }

  /**
   * Get a TouristCastle by ID
   */
  async getById(id: string, workspaceId: string): Promise<TouristCastleEntity | null> {
    try {
      return await this.touristCastleRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristCastle with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristCastle
   */
  async create(data: Partial<TouristCastleEntity>): Promise<TouristCastleEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const toCreate = new TouristCastleEntity(data)

      if (!toCreate.validate()) {
        throw new Error("Invalid TouristCastle data")
      }

      return await this.touristCastleRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristCastle:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristCastle
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristCastleEntity>
  ): Promise<TouristCastleEntity | null> {
    try {
      const existing = await this.touristCastleRepository.findById(id, workspaceId)
      if (!existing) {
        throw new Error("TouristCastle not found")
      }

      const toUpdate = new TouristCastleEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !toUpdate.validate()) {
        throw new Error("Invalid TouristCastle data")
      }

      return await this.touristCastleRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating TouristCastle with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristCastle
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const found = await this.touristCastleRepository.findById(id, workspaceId)
      if (!found) {
        throw new Error("TouristCastle not found")
      }

      return await this.touristCastleRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristCastle with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristCastleService()
