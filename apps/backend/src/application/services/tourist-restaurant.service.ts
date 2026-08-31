import { prisma } from "@echatbot/database"
import { TouristRestaurantEntity } from "../../domain/entities/tourist-restaurant.entity"
import { TouristRestaurantRepository } from "../../repositories/tourist-restaurant.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristRestaurant
 * Handles business logic for tourist restaurant recommendations
 */
export class TouristRestaurantService {
  private touristRestaurantRepository: any

  constructor() {
    this.touristRestaurantRepository = new TouristRestaurantRepository(prisma)
  }

  /**
   * Get all TouristRestaurants for a workspace
   */
  async getAllForWorkspace(
    workspaceId: string
  ): Promise<TouristRestaurantEntity[]> {
    try {
      return await this.touristRestaurantRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristRestaurants:", error)
      throw error
    }
  }

  /**
   * Get a TouristRestaurant by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<TouristRestaurantEntity | null> {
    try {
      return await this.touristRestaurantRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristRestaurant with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristRestaurant
   */
  async create(
    data: Partial<TouristRestaurantEntity>
  ): Promise<TouristRestaurantEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const touristRestaurantToCreate = new TouristRestaurantEntity(data)

      if (!touristRestaurantToCreate.validate()) {
        throw new Error("Invalid TouristRestaurant data")
      }

      return await this.touristRestaurantRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristRestaurant:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristRestaurant
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristRestaurantEntity>
  ): Promise<TouristRestaurantEntity | null> {
    try {
      const existing = await this.touristRestaurantRepository.findById(
        id,
        workspaceId
      )
      if (!existing) {
        throw new Error("TouristRestaurant not found")
      }

      const touristRestaurantToUpdate = new TouristRestaurantEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !touristRestaurantToUpdate.validate()) {
        throw new Error("Invalid TouristRestaurant data")
      }

      return await this.touristRestaurantRepository.update(
        id,
        workspaceId,
        data
      )
    } catch (error) {
      logger.error(`Error updating TouristRestaurant with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristRestaurant
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const touristRestaurant = await this.touristRestaurantRepository.findById(
        id,
        workspaceId
      )
      if (!touristRestaurant) {
        throw new Error("TouristRestaurant not found")
      }

      return await this.touristRestaurantRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristRestaurant with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristRestaurantService()
