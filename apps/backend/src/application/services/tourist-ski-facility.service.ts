import { prisma } from "@echatbot/database"
import { TouristSkiFacilityEntity } from "../../domain/entities/tourist-ski-facility.entity"
import { TouristSkiFacilityRepository } from "../../repositories/tourist-ski-facility.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristSkiFacility
 * Handles business logic for tourist ski facilities / slopes
 */
export class TouristSkiFacilityService {
  private touristSkiFacilityRepository: any

  constructor() {
    this.touristSkiFacilityRepository = new TouristSkiFacilityRepository(prisma)
  }

  /**
   * Get all TouristSkiFacilities for a workspace
   */
  async getAllForWorkspace(
    workspaceId: string
  ): Promise<TouristSkiFacilityEntity[]> {
    try {
      return await this.touristSkiFacilityRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristSkiFacilities:", error)
      throw error
    }
  }

  /**
   * Get a TouristSkiFacility by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<TouristSkiFacilityEntity | null> {
    try {
      return await this.touristSkiFacilityRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristSkiFacility with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristSkiFacility
   */
  async create(
    data: Partial<TouristSkiFacilityEntity>
  ): Promise<TouristSkiFacilityEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const touristSkiFacilityToCreate = new TouristSkiFacilityEntity(data)

      if (!touristSkiFacilityToCreate.validate()) {
        throw new Error("Invalid TouristSkiFacility data")
      }

      return await this.touristSkiFacilityRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristSkiFacility:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristSkiFacility
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristSkiFacilityEntity>
  ): Promise<TouristSkiFacilityEntity | null> {
    try {
      const existing = await this.touristSkiFacilityRepository.findById(
        id,
        workspaceId
      )
      if (!existing) {
        throw new Error("TouristSkiFacility not found")
      }

      const touristSkiFacilityToUpdate = new TouristSkiFacilityEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !touristSkiFacilityToUpdate.validate()) {
        throw new Error("Invalid TouristSkiFacility data")
      }

      return await this.touristSkiFacilityRepository.update(
        id,
        workspaceId,
        data
      )
    } catch (error) {
      logger.error(`Error updating TouristSkiFacility with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristSkiFacility
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const touristSkiFacility = await this.touristSkiFacilityRepository.findById(
        id,
        workspaceId
      )
      if (!touristSkiFacility) {
        throw new Error("TouristSkiFacility not found")
      }

      return await this.touristSkiFacilityRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristSkiFacility with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristSkiFacilityService()
