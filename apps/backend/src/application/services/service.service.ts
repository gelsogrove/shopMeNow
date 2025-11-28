import { Service } from "../../domain/entities/service.entity";
import { IServiceRepository } from "../../domain/repositories/service.repository.interface";
import { ServiceRepository } from "../../repositories/service.repository";
import logger from "../../utils/logger";

/**
 * Service for managing services
 */
class ServiceService {
  private serviceRepository: IServiceRepository;
  
  constructor() {
    this.serviceRepository = new ServiceRepository();
  }
  
  /**
   * Get all services for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<Service[]> {
    try {
      return await this.serviceRepository.findAll(workspaceId);
    } catch (error) {
      logger.error(`Error getting services for workspace ${workspaceId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a service by ID
   */
  async getById(id: string, workspaceId: string): Promise<Service | null> {
    try {
      const service = await this.serviceRepository.findById(id, workspaceId);
      
      if (!service) {
        return null;
      }
      
      return service;
    } catch (error) {
      logger.error(`Error getting service ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get services by IDs
   */
  async getByIds(ids: string[], workspaceId: string): Promise<Service[]> {
    try {
      return await this.serviceRepository.findByIds(ids, workspaceId);
    } catch (error) {
      logger.error("Error getting services by ids:", error);
      throw error;
    }
  }
  
  /**
   * Create a new service
   */
  async create(data: Partial<Service>): Promise<Service> {
    try {
      // Ensure required fields are present
      if (!data.name || !data.workspaceId) {
        throw new Error('Invalid service data');
      }
      
      // Create a service entity to validate the data
      const service = new Service(data);
      if (!service.validate()) {
        throw new Error('Invalid service data');
      }
      
      return await this.serviceRepository.create(service);
    } catch (error) {
      logger.error('Error creating service:', error);
      throw error;
    }
  }
  
  /**
   * Update a service
   */
  async update(id: string, workspaceId: string, data: Partial<Service>): Promise<Service> {
    try {
      // Check if service exists
      const existingService = await this.serviceRepository.findById(id, workspaceId);
      if (!existingService) {
        throw new Error('Service not found');
      }
      
      // Create a merged service entity to validate the updated data
      const mergedData = {
        ...existingService,
        ...data
      };
      
      // Create a service entity with the merged data to run validation
      const updatedService = new Service(mergedData);
      
      // Validate the updated service
      if (!updatedService.validate()) {
        throw new Error('Invalid service data');
      }
      
      const updated = await this.serviceRepository.update(id, workspaceId, data);
      if (!updated) {
        throw new Error('Service not found');
      }
      
      return updated;
    } catch (error) {
      logger.error(`Error updating service ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Hard delete a service
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      // Check if service exists first
      const existingService = await this.serviceRepository.findById(id, workspaceId);
      if (!existingService) {
        throw new Error('Service not found');
      }
      
      return await this.serviceRepository.delete(id, workspaceId);
    } catch (error) {
      logger.error(`Error deleting service ${id}:`, error);
      throw error;
    }
  }
}

export default new ServiceService(); 