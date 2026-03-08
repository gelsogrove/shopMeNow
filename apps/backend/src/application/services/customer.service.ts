import { Customer, CustomerProps } from "../../domain/entities/customer.entity"
import { ICustomerRepository } from "../../domain/repositories/customer.repository.interface"
import { CustomerRepository } from "../../repositories/customer.repository"
import logger from "../../utils/logger"
import { prisma } from "@echatbot/database"

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

      if (!data.currency) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: data.workspaceId },
          select: { currency: true },
        })
        data.currency = workspace?.currency || "USD"
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

      // Always delete related records first (even if hasRelatedRecords = false,
      // there might be FK constraints from tables not checked, e.g. agentConversationLog)
      await this.customerRepository.deleteRelatedRecords(id)

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

      // 🆕 Feature 174: Removed clearAttempts - RegistrationAttempts no longer used

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

  /**
   * 🆕 Widget Feature: Find or create customer by visitorId
   * Used for anonymous web visitors from embedded widget
   */
  async findOrCreateByVisitorId(
    workspaceId: string,
    visitorId: string
  ): Promise<Customer> {
    try {
      logger.info(`🔎 Looking for webvisitor: workspaceId=${workspaceId}, visitorId=${visitorId}`)
      
      // Try to find existing customer with this visitorId
      const existing = await prisma.customers.findFirst({
        where: {
          workspaceId,
          customId: visitorId,
        },
      })

      if (existing) {
        logger.info(`🔍 ✅ Found existing webvisitor: ${visitorId} (ID: ${existing.id})`)
        // Map Prisma record to CustomerProps (invoiceAddress is Json in DB, needs type casting)
        const customerProps: CustomerProps = {
          ...existing,
          invoiceAddress: existing.invoiceAddress as any, // Cast Json to InvoiceAddress
        }
        return new Customer(customerProps)
      }

      // Create new webvisitor customer
      logger.info(`✨ Creating new webvisitor: ${visitorId}`)
      const visitorData: CustomerProps = {
        workspaceId,
        customId: visitorId,
        name: "Web Visitor",
        email: `${visitorId}@webvisitor.temp`, // Temporary email
        phone: null,
        isActive: false, // Not registered yet
        language: "ENG",
        currency: "USD",
      }

      const created = await this.customerRepository.create(visitorData)
      logger.info(`✨ ✅ New webvisitor created: ${visitorId} (ID: ${created.id})`)
      return created
    } catch (error) {
      logger.error(`Error finding/creating webvisitor ${visitorId}:`, error)
      throw error
    }
  }

  /**
   * 🆕 Widget Feature: Convert webvisitor to registered customer
   * Merges visitor data with registration data, preserves chat history
   */
  async convertVisitorToCustomer(
    visitorId: string,
    customerData: {
      workspaceId: string
      phone: string
      firstName: string
      lastName: string
      email: string
      language?: string
    }
  ): Promise<Customer> {
    try {
      // Find existing webvisitor
      const visitor = await prisma.customers.findFirst({
        where: {
          customId: visitorId,
          workspaceId: customerData.workspaceId,
        },
      })

      if (!visitor) {
        throw new Error(`Webvisitor ${visitorId} not found`)
      }

      logger.info(`🔄 Converting webvisitor ${visitorId} to registered customer`)

      // Check if phone already exists (avoid duplicates)
      const existingByPhone = await this.customerRepository.findByPhone(
        customerData.phone,
        customerData.workspaceId
      )

      if (existingByPhone && existingByPhone.id !== visitor.id) {
        throw new Error("Phone number already registered")
      }

      // Check if email already exists
      const existingByEmail = await this.customerRepository.findByEmail(
        customerData.email,
        customerData.workspaceId
      )

      if (existingByEmail && existingByEmail.id !== visitor.id) {
        throw new Error("Email already registered")
      }

      // Update visitor with real customer data
      const updatedCustomer = await this.customerRepository.update(
        visitor.id,
        customerData.workspaceId,
        {
          phone: customerData.phone,
          name: `${customerData.firstName} ${customerData.lastName}`,
          email: customerData.email,
          language: customerData.language || visitor.language,
          isActive: true, // Now registered
          customId: null, // Clear visitorId, now it's a real customer
        }
      )

      logger.info(
        `✅ Webvisitor converted: ${visitorId} → Customer ${updatedCustomer.id}`
      )

      return updatedCustomer
    } catch (error) {
      logger.error(`Error converting webvisitor ${visitorId}:`, error)
      throw error
    }
  }
}

// Export a singleton instance for backward compatibility
export default new CustomerService()
