import { prisma } from "@echatbot/database"
import { TouristSportsFacilityEntity } from "../../domain/entities/tourist-sports-facility.entity"
import { TouristSportsFacilityRepository } from "../../repositories/tourist-sports-facility.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristSportsFacility
 * Handles business logic for tourist sports facilities (e.g. golf, tennis)
 */
export class TouristSportsFacilityService {
  private touristSportsFacilityRepository: any

  constructor() {
    this.touristSportsFacilityRepository = new TouristSportsFacilityRepository(prisma)
  }

  /**
   * Get all TouristSportsFacilities for a workspace
   */
  async getAllForWorkspace(
    workspaceId: string
  ): Promise<TouristSportsFacilityEntity[]> {
    try {
      return await this.touristSportsFacilityRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristSportsFacilities:", error)
      throw error
    }
  }

  /**
   * Get a TouristSportsFacility by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<TouristSportsFacilityEntity | null> {
    try {
      return await this.touristSportsFacilityRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristSportsFacility with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristSportsFacility
   */
  async create(
    data: Partial<TouristSportsFacilityEntity>
  ): Promise<TouristSportsFacilityEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const touristSportsFacilityToCreate = new TouristSportsFacilityEntity(data)

      if (!touristSportsFacilityToCreate.validate()) {
        throw new Error("Invalid TouristSportsFacility data")
      }

      return await this.touristSportsFacilityRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristSportsFacility:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristSportsFacility
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristSportsFacilityEntity>
  ): Promise<TouristSportsFacilityEntity | null> {
    try {
      const existing = await this.touristSportsFacilityRepository.findById(
        id,
        workspaceId
      )
      if (!existing) {
        throw new Error("TouristSportsFacility not found")
      }

      const touristSportsFacilityToUpdate = new TouristSportsFacilityEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !touristSportsFacilityToUpdate.validate()) {
        throw new Error("Invalid TouristSportsFacility data")
      }

      return await this.touristSportsFacilityRepository.update(
        id,
        workspaceId,
        data
      )
    } catch (error) {
      logger.error(`Error updating TouristSportsFacility with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristSportsFacility
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const touristSportsFacility = await this.touristSportsFacilityRepository.findById(
        id,
        workspaceId
      )
      if (!touristSportsFacility) {
        throw new Error("TouristSportsFacility not found")
      }

      return await this.touristSportsFacilityRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristSportsFacility with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristSportsFacilityService()
