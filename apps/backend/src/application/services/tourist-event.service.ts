import { prisma } from "@echatbot/database"
import { TouristEventEntity } from "../../domain/entities/tourist-event.entity"
import { TouristEventRepository } from "../../repositories/tourist-event.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristEvent
 * Handles business logic for tourist event recommendations
 */
export class TouristEventService {
  private touristEventRepository: any

  constructor() {
    this.touristEventRepository = new TouristEventRepository(prisma)
  }

  /**
   * Get all TouristEvents for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<TouristEventEntity[]> {
    try {
      return await this.touristEventRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristEvents:", error)
      throw error
    }
  }

  /**
   * Get a TouristEvent by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<TouristEventEntity | null> {
    try {
      return await this.touristEventRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristEvent with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristEvent
   */
  async create(
    data: Partial<TouristEventEntity>
  ): Promise<TouristEventEntity> {
    try {
      if (!data.title || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const touristEventToCreate = new TouristEventEntity(data)

      if (!touristEventToCreate.validate()) {
        throw new Error("Invalid TouristEvent data")
      }

      return await this.touristEventRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristEvent:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristEvent
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristEventEntity>
  ): Promise<TouristEventEntity | null> {
    try {
      const existing = await this.touristEventRepository.findById(id, workspaceId)
      if (!existing) {
        throw new Error("TouristEvent not found")
      }

      const touristEventToUpdate = new TouristEventEntity({
        ...existing,
        ...data,
      })

      if (data.title !== undefined && !touristEventToUpdate.validate()) {
        throw new Error("Invalid TouristEvent data")
      }

      return await this.touristEventRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating TouristEvent with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristEvent
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const touristEvent = await this.touristEventRepository.findById(id, workspaceId)
      if (!touristEvent) {
        throw new Error("TouristEvent not found")
      }

      return await this.touristEventRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristEvent with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristEventService()
