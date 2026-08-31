import { prisma } from "@echatbot/database"
import { TouristApartmentEntity } from "../../domain/entities/tourist-apartment.entity"
import { TouristApartmentRepository } from "../../repositories/tourist-apartment.repository"
import logger from "../../utils/logger"

/**
 * Service layer for TouristApartment
 * Handles business logic for vacation house/apartment recommendations
 */
export class TouristApartmentService {
  private touristApartmentRepository: any

  constructor() {
    this.touristApartmentRepository = new TouristApartmentRepository(prisma)
  }

  /**
   * Get all TouristApartments for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<TouristApartmentEntity[]> {
    try {
      return await this.touristApartmentRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all TouristApartments:", error)
      throw error
    }
  }

  /**
   * Get a TouristApartment by ID
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<TouristApartmentEntity | null> {
    try {
      return await this.touristApartmentRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting TouristApartment with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new TouristApartment
   */
  async create(
    data: Partial<TouristApartmentEntity>
  ): Promise<TouristApartmentEntity> {
    try {
      if (!data.name || !data.workspaceId) {
        throw new Error("Missing required fields")
      }

      const touristApartmentToCreate = new TouristApartmentEntity(data)

      if (!touristApartmentToCreate.validate()) {
        throw new Error("Invalid TouristApartment data")
      }

      return await this.touristApartmentRepository.create(data)
    } catch (error) {
      logger.error("Error creating TouristApartment:", error)
      throw error
    }
  }

  /**
   * Update an existing TouristApartment
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<TouristApartmentEntity>
  ): Promise<TouristApartmentEntity | null> {
    try {
      const existing = await this.touristApartmentRepository.findById(
        id,
        workspaceId
      )
      if (!existing) {
        throw new Error("TouristApartment not found")
      }

      const touristApartmentToUpdate = new TouristApartmentEntity({
        ...existing,
        ...data,
      })

      if (data.name !== undefined && !touristApartmentToUpdate.validate()) {
        throw new Error("Invalid TouristApartment data")
      }

      return await this.touristApartmentRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating TouristApartment with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a TouristApartment
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const touristApartment = await this.touristApartmentRepository.findById(
        id,
        workspaceId
      )
      if (!touristApartment) {
        throw new Error("TouristApartment not found")
      }

      return await this.touristApartmentRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristApartment with id ${id}:`, error)
      throw error
    }
  }
}

export default new TouristApartmentService()
