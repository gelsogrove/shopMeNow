import { prisma } from "@echatbot/database"
import { TouristHotelEntity } from "../../domain/entities/tourist-hotel.entity"
import { TouristHotelRepository } from "../../repositories/tourist-hotel.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristHotel
 * Handles business logic for tourist hotel recommendations
 */
export class TouristHotelService {
  private touristHotelRepository: any

  constructor() {
    this.touristHotelRepository = new TouristHotelRepository(prisma)
  }

  /**
   * Get all TouristHotels for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<TouristHotelEntity[]> {
    try {
      return await this.touristHotelRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristHotels:", error)
      throw error
    }
  }

  /**
   * Get a TouristHotel by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<TouristHotelEntity | null> {
    try {
      return await this.touristHotelRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristHotel with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristHotel
   */
  async create(data: Partial<TouristHotelEntity>): Promise<TouristHotelEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const touristHotelToCreate = new TouristHotelEntity(data)

      if (!touristHotelToCreate.validate()) {
        throw new Error("Invalid TouristHotel data")
      }

      return await this.touristHotelRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristHotel:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristHotel
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristHotelEntity>
  ): Promise<TouristHotelEntity | null> {
    try {
      const existing = await this.touristHotelRepository.findById(
        id,
        workspaceId
      )
      if (!existing) {
        throw new Error("TouristHotel not found")
      }

      const touristHotelToUpdate = new TouristHotelEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !touristHotelToUpdate.validate()) {
        throw new Error("Invalid TouristHotel data")
      }

      return await this.touristHotelRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating TouristHotel with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristHotel
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const touristHotel = await this.touristHotelRepository.findById(
        id,
        workspaceId
      )
      if (!touristHotel) {
        throw new Error("TouristHotel not found")
      }

      return await this.touristHotelRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristHotel with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristHotelService()
