import { prisma } from "@echatbot/database"
import { TouristVenueEntity } from "../../domain/entities/tourist-venue.entity"
import { TouristVenueRepository } from "../../repositories/tourist-venue.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristVenue
 * Handles business logic for tourist venues
 */
export class TouristVenueService {
  private touristVenueRepository: any

  constructor() {
    this.touristVenueRepository = new TouristVenueRepository(prisma)
  }

  /**
   * Get all TouristVenues for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<TouristVenueEntity[]> {
    try {
      return await this.touristVenueRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristVenues:", error)
      throw error
    }
  }

  /**
   * Get a TouristVenue by ID
   */
  async getById(id: string, workspaceId: string): Promise<TouristVenueEntity | null> {
    try {
      return await this.touristVenueRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristVenue with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristVenue
   */
  async create(data: Partial<TouristVenueEntity>): Promise<TouristVenueEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const toCreate = new TouristVenueEntity(data)

      if (!toCreate.validate()) {
        throw new Error("Invalid TouristVenue data")
      }

      return await this.touristVenueRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristVenue:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristVenue
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristVenueEntity>
  ): Promise<TouristVenueEntity | null> {
    try {
      const existing = await this.touristVenueRepository.findById(id, workspaceId)
      if (!existing) {
        throw new Error("TouristVenue not found")
      }

      const toUpdate = new TouristVenueEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !toUpdate.validate()) {
        throw new Error("Invalid TouristVenue data")
      }

      return await this.touristVenueRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating TouristVenue with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristVenue
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const found = await this.touristVenueRepository.findById(id, workspaceId)
      if (!found) {
        throw new Error("TouristVenue not found")
      }

      return await this.touristVenueRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristVenue with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristVenueService()
