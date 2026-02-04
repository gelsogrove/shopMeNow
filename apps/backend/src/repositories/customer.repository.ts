import { Customer, CustomerProps } from "../domain/entities/customer.entity"
import { ICustomerRepository } from "../domain/repositories/customer.repository.interface"
import { prisma } from "../lib/prisma"
import logger from "../utils/logger"
import { normalizePhone } from "../utils/phone-normalizer"

/**
 * Implementation of Customer Repository using Prisma
 */
export class CustomerRepository implements ICustomerRepository {
  /**
   * Convert Prisma model to domain entity
   */
  private toDomainEntity(customerData: any): Customer {
    return new Customer({
      id: customerData.id,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      customId: customerData.customId, // 🆕 Widget: visitor tracking
      address: customerData.address,
      company: customerData.company,
      discount: customerData.discount,
      language: customerData.language,
      currency: customerData.currency,
      notes: customerData.notes,
      tags: customerData.tags,
      serviceIds: customerData.serviceIds,
      isBlacklisted: customerData.isBlacklisted,
      isActive: customerData.isActive,
      workspaceId: customerData.workspaceId,
      last_privacy_version_accepted: customerData.last_privacy_version_accepted,
      privacy_accepted_at: customerData.privacy_accepted_at,
      push_notifications_consent: customerData.push_notifications_consent,
      push_notifications_consent_at: customerData.push_notifications_consent_at,
      createdAt: customerData.createdAt,
      updatedAt: customerData.updatedAt,
      activeChatbot: customerData.activeChatbot,
      invoiceAddress: customerData.invoiceAddress,
      salesId: customerData.salesId,
      feedbacks: customerData.feedbacks || [],
    })
  }

  /**
   * Find all customers in a workspace
   */
  async findAll(workspaceId: string): Promise<Customer[]> {
    try {
      const customers = await prisma.customers.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
      })

      return customers
        ? customers.map((customer) => this.toDomainEntity(customer))
        : []
    } catch (error) {
      logger.error("Error finding all customers:", error)
      return []
    }
  }

  /**
   * Find all active customers in a workspace
   */
  async findActive(workspaceId: string): Promise<Customer[]> {
    try {
      const customers = await prisma.customers.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
        include: {
          feedbacks: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })

      return customers
        ? customers.map((customer) => this.toDomainEntity(customer))
        : []
    } catch (error) {
      logger.error("Error finding active customers:", error)
      return []
    }
  }

  /**
   * Find a single customer by ID and workspace
   */
  async findById(id: string, workspaceId: string): Promise<Customer | null> {
    try {
      const customer = await prisma.customers.findFirst({
        where: {
          id,
          workspaceId,
        },
      })

      return customer ? this.toDomainEntity(customer) : null
    } catch (error) {
      logger.error(`Error finding customer ${id}:`, error)
      return null
    }
  }

  /**
   * Find a customer by email
   */
  async findByEmail(
    email: string,
    workspaceId: string
  ): Promise<Customer | null> {
    try {
      const customer = await prisma.customers.findFirst({
        where: {
          email,
          workspaceId,
        },
      })

      return customer ? this.toDomainEntity(customer) : null
    } catch (error) {
      logger.error(`Error finding customer by email ${email}:`, error)
      return null
    }
  }

  /**
   * Find a customer by phone
   */
  async findByPhone(
    phone: string,
    workspaceId: string
  ): Promise<Customer | null> {
    try {
      const normalizedPhone = normalizePhone(phone)
      
      // Try with normalized phone first
      let customer = await prisma.customers.findFirst({
        where: {
          phone: normalizedPhone,
          workspaceId,
        },
      })
      
      // If not found and original differs, try original
      if (!customer && normalizedPhone !== phone) {
        customer = await prisma.customers.findFirst({
          where: {
            phone: phone,
            workspaceId,
          },
        })
      }

      return customer ? this.toDomainEntity(customer) : null
    } catch (error) {
      logger.error(`Error finding customer by phone ${phone}:`, error)
      return null
    }
  }

  /**
   * Create a new customer
   */
  async create(data: CustomerProps): Promise<Customer> {
    try {
      const normalizedPhone = data.phone ? normalizePhone(data.phone) : undefined
      const customerData: any = {
        name: data.name,
        email: data.email,
        phone: normalizedPhone,
        address: data.address,
        company: data.company,
        discount: data.discount,
        language: data.language,
        currency: data.currency,
        notes: data.notes,
        tags: data.tags || [],
        serviceIds: data.serviceIds || [],
        isBlacklisted: data.isBlacklisted || false,
        isActive: data.isActive !== undefined ? data.isActive : true,
        workspaceId: data.workspaceId,
        customId: data.customId, // 🆕 Save widget visitorId
        last_privacy_version_accepted: data.last_privacy_version_accepted,
        privacy_accepted_at: data.privacy_accepted_at,
        push_notifications_consent: data.push_notifications_consent || false,
        push_notifications_consent_at: data.push_notifications_consent_at,
        activeChatbot:
          data.activeChatbot !== undefined ? data.activeChatbot : true,
        invoiceAddress: data.invoiceAddress,
      }

      const customer = await prisma.customers.create({
        data: customerData,
      })

      return this.toDomainEntity(customer)
    } catch (error: any) {
      // P2002: Unique constraint violation (phone or email already exists)
      if (error.code === "P2002") {
        logger.error(
          `CustomerRepository.create: Unique constraint violation for phone ${data.phone} or email ${data.email}`,
          error
        )

        // Fetch the existing customer using normalized phone
        const normalizedPhoneSearch = data.phone ? normalizePhone(data.phone) : undefined
        const existingCustomer = await prisma.customers.findFirst({
          where: {
            OR: [
              { phone: normalizedPhoneSearch, workspaceId: data.workspaceId },
              { email: data.email, workspaceId: data.workspaceId },
            ],
          },
        })

        if (existingCustomer) {
          logger.info(
            `CustomerRepository.create: ✅ Returning existing customer ${existingCustomer.id}`
          )
          return this.toDomainEntity(existingCustomer)
        }

        // Should never reach here
        logger.error(
          "CustomerRepository.create: CRITICAL - Customer not found after P2002 error"
        )
        throw new Error("Numero di telefono o email già registrati nel sistema")
      }

      // Different error, rethrow
      logger.error("Error creating customer:", error)
      throw error
    }
  }

  /**
   * Update a customer record
   * @param id Customer ID
   * @param workspaceId Workspace ID
   * @param data Customer data to update
   * @returns Updated customer record
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<CustomerProps>
  ): Promise<Customer | null> {
    try {
      // Verify customer belongs to this workspace
      const existing = await this.findById(id, workspaceId)
      if (!existing) {
        return null
      }

      // Manually map fields that can be updated, excluding workspaceId and id
      const updateData: any = {}

      if (data.name !== undefined) updateData.name = data.name
      if (data.email !== undefined) updateData.email = data.email
      if (data.phone !== undefined) updateData.phone = normalizePhone(data.phone)
      if (data.address !== undefined) updateData.address = data.address
      if (data.company !== undefined) updateData.company = data.company
      if (data.discount !== undefined) updateData.discount = data.discount
      if (data.language !== undefined) updateData.language = data.language
      if (data.currency !== undefined) updateData.currency = data.currency
      if (data.notes !== undefined) updateData.notes = data.notes
      if (data.tags !== undefined) updateData.tags = data.tags
      if (data.serviceIds !== undefined) updateData.serviceIds = data.serviceIds
      if (data.isBlacklisted !== undefined)
        updateData.isBlacklisted = data.isBlacklisted
      if (data.isActive !== undefined) updateData.isActive = data.isActive
      if (data.last_privacy_version_accepted !== undefined)
        updateData.last_privacy_version_accepted =
          data.last_privacy_version_accepted
      if (data.privacy_accepted_at !== undefined)
        updateData.privacy_accepted_at = data.privacy_accepted_at
      if (data.push_notifications_consent !== undefined)
        updateData.push_notifications_consent = data.push_notifications_consent
      if (data.push_notifications_consent_at !== undefined)
        updateData.push_notifications_consent_at =
          data.push_notifications_consent_at
      if (data.activeChatbot !== undefined)
        updateData.activeChatbot = data.activeChatbot
      if (data.invoiceAddress !== undefined)
        updateData.invoiceAddress = data.invoiceAddress
      if (data.salesId !== undefined) updateData.salesId = data.salesId

      // Debug log
      logger.info("=== REPOSITORY UPDATE DEBUG ===")
      logger.info("data.salesId:", data.salesId)
      logger.info("updateData.salesId:", updateData.salesId)
      logger.info("Full updateData:", updateData)
      logger.info("==============================")

      // Update the customer record
      const updatedCustomer = await prisma.customers.update({
        where: { id },
        data: updateData,
      })

      logger.info("=== PRISMA UPDATE RESULT ===")
      logger.info("updatedCustomer.salesId:", updatedCustomer.salesId)
      logger.info("===========================")
      // Convert to domain entity
      return this.toDomainEntity(updatedCustomer)
    } catch (error) {
      logger.error(`Error updating customer ${id}:`, error)
      return null
    }
  }

  /**
   * Soft delete a customer (mark as inactive)
   */
  async softDelete(id: string, workspaceId: string): Promise<boolean> {
    try {
      await prisma.customers.update({
        where: {
          id,
          workspaceId,
        },
        data: {
          isActive: false,
        },
      })

      return true
    } catch (error) {
      logger.error(`Error soft-deleting customer ${id}:`, error)
      return false
    }
  }

  /**
   * Hard delete a customer (remove from database)
   */
  async hardDelete(id: string, workspaceId: string): Promise<boolean> {
    try {
      // First check if the customer exists
      const customer = await prisma.customers.findFirst({
        where: {
          id,
          workspaceId,
        },
      })

      if (!customer) {
        return false
      }

      // Delete the customer
      await prisma.customers.delete({
        where: {
          id,
        },
      })

      return true
    } catch (error) {
      logger.error(`Error hard-deleting customer ${id}:`, error)
      return false
    }
  }

  /**
   * Count customers with a specific name in a workspace
   */
  async countByName(name: string, workspaceId: string): Promise<number> {
    try {
      const count = await prisma.customers.count({
        where: {
          name,
          workspaceId,
          isActive: true,
        },
      })

      return count
    } catch (error) {
      logger.error(`Error counting customers with name ${name}:`, error)
      throw error
    }
  }

  /**
   * Check if customer has related records (orders, chat sessions)
   */
  async hasRelatedRecords(id: string): Promise<boolean> {
    try {
      // Check for orders
      const ordersCount = await prisma.orders.count({
        where: { customerId: id },
      })

      // Check for chat sessions
      const chatSessionsCount = await prisma.chatSession.count({
        where: { customerId: id },
      })

      return ordersCount > 0 || chatSessionsCount > 0
    } catch (error) {
      logger.error(
        `Error checking if customer ${id} has related records:`,
        error
      )
      throw error
    }
  }

  /**
   * Delete related records before deleting the customer
   */
  async deleteRelatedRecords(id: string): Promise<void> {
    try {
      logger.info(`Starting to delete related records for customer ${id}`)

      // Delete messages from chat sessions
      await prisma.message.deleteMany({
        where: {
          chatSession: {
            customerId: id,
          },
        },
      })

      // Delete chat sessions
      await prisma.chatSession.deleteMany({
        where: { customerId: id },
      })

      // Delete order items first (RESTRICT constraint on orderId)
      await prisma.orderItems.deleteMany({
        where: {
          order: {
            customerId: id,
          },
        },
      })

      // Delete credit notes (cascade from orders)
      await prisma.creditNote.deleteMany({
        where: {
          order: {
            customerId: id,
          },
        },
      })

      // Delete payment details (cascade from orders)
      await prisma.paymentDetails.deleteMany({
        where: {
          order: {
            customerId: id,
          },
        },
      })

      // Delete orders
      await prisma.orders.deleteMany({
        where: { customerId: id },
      })

      logger.info(`Successfully deleted all related records for customer ${id}`)
    } catch (error) {
      logger.error(`Error deleting related records for customer ${id}:`, error)
      throw error
    }
  }
}
