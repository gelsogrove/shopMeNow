import { Customer, CustomerProps } from "../../domain/entities/customer.entity"
import { ICustomerRepository } from "../../domain/repositories/customer.repository.interface"
import { CustomerRepository } from "../../repositories/customer.repository"
import logger from "../../utils/logger"

/**
 * Service layer for Customer
 * Handles business logic for customers
 */
export class CustomerService {
  private customerRepository: ICustomerRepository

  constructor() {
    this.customerRepository = new CustomerRepository()
  }

  /**
   * Get all customers for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<Customer[]> {
    try {
      return await this.customerRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all customers:", error)
      throw error
    }
  }

  /**
   * Get active customers for a workspace
   */
  async getActiveForWorkspace(workspaceId: string): Promise<Customer[]> {
    try {
      return await this.customerRepository.findActive(workspaceId)
    } catch (error) {
      logger.error("Error getting active customers:", error)
      throw error
    }
  }

  /**
   * Get a customer by ID
   */
  async getById(id: string, workspaceId: string): Promise<Customer | null> {
    try {
      return await this.customerRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting customer with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new customer
   */
  async create(data: CustomerProps): Promise<Customer> {
    try {
      // Validate required fields
      if (!data.name || !data.email || !data.workspaceId) {
        throw new Error("Name, email and workspace ID are required")
      }

      // Create a customer entity for validation
      const customerToCreate = new Customer(data)

      // Validate the customer
      if (!customerToCreate.validate()) {
        throw new Error("Invalid customer data")
      }

      // Check if email is already in use
      const existingCustomerByEmail = await this.customerRepository.findByEmail(
        data.email,
        data.workspaceId
      )
      if (existingCustomerByEmail) {
        throw new Error("A customer with this email already exists")
      }

      // Check if phone is already in use (if provided)
      if (data.phone) {
        const existingCustomerByPhone =
          await this.customerRepository.findByPhone(
            data.phone,
            data.workspaceId
          )
        if (existingCustomerByPhone) {
          throw new Error("A customer with this phone number already exists")
        }
      }

      // Create the customer
      return await this.customerRepository.create(data)
    } catch (error) {
      logger.error("Error creating customer:", error)
      throw error
    }
  }

  /**
   * Update an existing customer
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<CustomerProps>
  ): Promise<Customer> {
    try {
      // Check if customer exists
      const existingCustomer = await this.customerRepository.findById(
        id,
        workspaceId
      )
      if (!existingCustomer) {
        throw new Error("Customer not found")
      }

      // Create merged customer for validation if name or email are being updated
      if (data.name !== undefined || data.email !== undefined) {
        const customerToUpdate = new Customer({
          ...existingCustomer,
          name: data.name ?? existingCustomer.name,
          email: data.email ?? existingCustomer.email,
          workspaceId: existingCustomer.workspaceId,
        })

        // Validate the customer
        if (!customerToUpdate.validate()) {
          throw new Error("Invalid customer data")
        }
      }

      // Check email uniqueness if it's being updated
      if (data.email && data.email !== existingCustomer.email) {
        const customerWithEmail = await this.customerRepository.findByEmail(
          data.email,
          workspaceId
        )
        if (customerWithEmail && customerWithEmail.id !== id) {
          throw new Error("Email is already in use by another customer")
        }
      }

      // Check phone uniqueness if it's being updated
      if (data.phone && data.phone !== existingCustomer.phone) {
        const customerWithPhone = await this.customerRepository.findByPhone(
          data.phone,
          workspaceId
        )
        if (customerWithPhone && customerWithPhone.id !== id) {
          throw new Error("Phone number is already in use by another customer")
        }
      }

      // Update the customer
      return await this.customerRepository.update(id, workspaceId, data)
    } catch (error) {
      logger.error(`Error updating customer with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a customer
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      // Check if customer exists
      const customer = await this.customerRepository.findById(id, workspaceId)
      if (!customer) {
        throw new Error("Customer not found")
      }

      // Check if customer has related records
      const hasRelatedRecords =
        await this.customerRepository.hasRelatedRecords(id)

      if (hasRelatedRecords) {
        // Delete related records first
        await this.customerRepository.deleteRelatedRecords(id)
      }

      // Delete the customer
      return await this.customerRepository.hardDelete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting customer with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete a customer (mark as inactive)
   */
  async softDelete(id: string, workspaceId: string): Promise<boolean> {
    try {
      // Check if customer exists
      const customer = await this.customerRepository.findById(id, workspaceId)
      if (!customer) {
        throw new Error("Customer not found")
      }

      // Soft delete the customer
      return await this.customerRepository.softDelete(id, workspaceId)
    } catch (error) {
      logger.error(`Error soft-deleting customer with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Block a customer by setting isBlacklisted to true
   */
  async blockCustomer(id: string, workspaceId: string): Promise<Customer> {
    try {
      // Check if customer exists
      const customer = await this.customerRepository.findById(id, workspaceId)
      if (!customer) {
        throw new Error("Customer not found")
      }

      // Set isBlacklisted to true
      return await this.customerRepository.update(id, workspaceId, {
        isBlacklisted: true,
      })
    } catch (error) {
      logger.error(`Error blocking customer with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Unblock a customer by setting isBlacklisted to false
   * Also clears registration attempts to give the user a fresh start
   */
  async unblockCustomer(id: string, workspaceId: string): Promise<Customer> {
    try {
      // Check if customer exists
      const customer = await this.customerRepository.findById(id, workspaceId)
      if (!customer) {
        throw new Error("Customer not found")
      }

      // Set isBlacklisted to false
      const updatedCustomer = await this.customerRepository.update(id, workspaceId, {
        isBlacklisted: false,
      })

      // 🔄 RESET REGISTRATION ATTEMPTS - Clear attempts when unblocking
      try {
        const { RegistrationAttemptsService } = await import("./registration-attempts.service")
        const { PrismaClient } = await import("@prisma/client")
        const prisma = new PrismaClient()
        const registrationAttemptsService = new RegistrationAttemptsService(prisma)
        
        await registrationAttemptsService.clearAttempts(customer.phone, workspaceId)
        logger.info(`[CUSTOMER_SERVICE] Cleared registration attempts for unblocked customer ${customer.phone} in workspace ${workspaceId}`)
        
        await prisma.$disconnect()
      } catch (clearError) {
        logger.error(`[CUSTOMER_SERVICE] Error clearing registration attempts for customer ${customer.phone}:`, clearError)
        // Don't fail the unblock operation if clearing attempts fails
      }

      return updatedCustomer
    } catch (error) {
      logger.error(`Error unblocking customer with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Count unknown customers in a workspace
   */
  async countUnknownCustomers(workspaceId: string): Promise<number> {
    try {
      return await this.customerRepository.countByName(
        "Unknown Customer",
        workspaceId
      )
    } catch (error) {
      logger.error("Error counting unknown customers:", error)
      throw error
    }
  }
}

// Export a singleton instance for backward compatibility
export default new CustomerService()
