import { prisma } from "@echatbot/database"
import { TouristViewpointEntity } from "../../domain/entities/tourist-viewpoint.entity"
import { TouristViewpointRepository } from "../../repositories/tourist-viewpoint.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristViewpoint
 * Handles business logic for tourist viewpoints
 */
export class TouristViewpointService {
  private touristViewpointRepository: any

  constructor() {
    this.touristViewpointRepository = new TouristViewpointRepository(prisma)
  }

  /**
   * Get all TouristViewpoints for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<TouristViewpointEntity[]> {
    try {
      return await this.touristViewpointRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristViewpoints:", error)
      throw error
    }
  }

  /**
   * Get a TouristViewpoint by ID
   */
  async getById(id: string, workspaceId: string): Promise<TouristViewpointEntity | null> {
    try {
      return await this.touristViewpointRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristViewpoint with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristViewpoint
   */
  async create(data: Partial<TouristViewpointEntity>): Promise<TouristViewpointEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const toCreate = new TouristViewpointEntity(data)

      if (!toCreate.validate()) {
        throw new Error("Invalid TouristViewpoint data")
      }

      return await this.touristViewpointRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristViewpoint:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristViewpoint
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristViewpointEntity>
  ): Promise<TouristViewpointEntity | null> {
    try {
      const existing = await this.touristViewpointRepository.findById(id, workspaceId)
      if (!existing) {
        throw new Error("TouristViewpoint not found")
      }

      const toUpdate = new TouristViewpointEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !toUpdate.validate()) {
        throw new Error("Invalid TouristViewpoint data")
      }

      return await this.touristViewpointRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating TouristViewpoint with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristViewpoint
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const found = await this.touristViewpointRepository.findById(id, workspaceId)
      if (!found) {
        throw new Error("TouristViewpoint not found")
      }

      return await this.touristViewpointRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristViewpoint with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristViewpointService()
