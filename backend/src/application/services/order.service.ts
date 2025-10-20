import { OrderStatus, PrismaClient } from "@prisma/client"
import { Order } from "../../domain/entities/order.entity"
import {
  IOrderRepository,
  OrderFilters,
} from "../../domain/repositories/order.repository.interface"
import { OrderRepository } from "../../repositories/order.repository"
import logger from "../../utils/logger"
import { BillingService } from "./billing.service"
import { CustomerService } from "./customer.service"
import { StockService } from "./stock.service"

const prisma = new PrismaClient()

export class OrderService {
  private orderRepository: IOrderRepository
  private stockService: StockService
  private customerService: CustomerService
  private billingService: BillingService

  constructor(
    orderRepository?: IOrderRepository,
    stockService?: StockService,
    customerService?: CustomerService
  ) {
    this.orderRepository = orderRepository || new OrderRepository()
    this.stockService = stockService || new StockService()
    this.customerService = customerService || new CustomerService()
    this.billingService = new BillingService(prisma)
  }

  async getAllOrders(workspaceId: string, filters?: OrderFilters) {
    try {
      logger.info("OrderService.getAllOrders called with:", {
        workspaceId,
        filters,
      })
      return await this.orderRepository.findAll(workspaceId, filters)
    } catch (error) {
      logger.error("Error in order service getAllOrders:", error)
      throw new Error(`Failed to get orders: ${(error as Error).message}`)
    }
  }

  async getOrderById(id: string, workspaceId: string): Promise<Order | null> {
    try {
      if (!id) {
        throw new Error("Order ID is required")
      }

      return await this.orderRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(
        `Error in order service getOrderById for order ${id}:`,
        error
      )
      throw new Error(`Failed to get order: ${(error as Error).message}`)
    }
  }

  async getOrderByCode(
    orderCode: string,
    workspaceId: string
  ): Promise<Order | null> {
    try {
      if (!orderCode) {
        throw new Error("Order code is required")
      }

      return await this.orderRepository.findByOrderCode(orderCode, workspaceId)
    } catch (error) {
      logger.error(
        `Error in order service getOrderByCode for order ${orderCode}:`,
        error
      )
      throw new Error(
        `Failed to get order by code: ${(error as Error).message}`
      )
    }
  }

  async getOrdersByCustomerId(
    customerId: string,
    workspaceId: string
  ): Promise<Order[]> {
    try {
      if (!customerId) {
        throw new Error("Customer ID is required")
      }

      return await this.orderRepository.findByCustomerId(
        customerId,
        workspaceId
      )
    } catch (error) {
      logger.error(
        `Error in order service getOrdersByCustomerId for customer ${customerId}:`,
        error
      )
      throw new Error(
        `Failed to get orders by customer: ${(error as Error).message}`
      )
    }
  }

  async createOrder(orderData: Partial<Order>): Promise<Order> {
    try {
      if (!orderData.customerId) {
        throw new Error("Customer ID is required")
      }

      if (!orderData.workspaceId) {
        throw new Error("Workspace ID is required")
      }

      if (!orderData.items || orderData.items.length === 0) {
        throw new Error("Order must have at least one item")
      }

      if (!orderData.totalAmount || orderData.totalAmount <= 0) {
        throw new Error("Total amount must be greater than 0")
      }

      // Get customer data to populate shipping address
      const customer = await this.customerService.getById(
        orderData.customerId,
        orderData.workspaceId
      )
      if (!customer) {
        throw new Error("Customer not found")
      }

      // Set default values
      orderData.status = orderData.status || OrderStatus.PENDING
      orderData.shippingAmount = orderData.shippingAmount || 0
      orderData.taxAmount = orderData.taxAmount || 0
      orderData.discountAmount = orderData.discountAmount || 0

      // Populate shipping address from customer if not provided
      if (!orderData.shippingAddress && customer.address) {
        // Split customer name into firstName and lastName
        const nameParts = customer.name.trim().split(" ")
        const firstName = nameParts[0] || ""
        const lastName =
          nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""

        // Create a structured shipping address from customer's address field
        orderData.shippingAddress = {
          firstName,
          lastName,
          address: customer.address,
          city: "", // Could be parsed from address if needed
          postalCode: "",
          country: "",
          phone: customer.phone || undefined,
        }

        logger.info("Populated shipping address from customer:", {
          customerId: customer.id,
          customerName: customer.name,
          customerAddress: customer.address,
          shippingAddress: orderData.shippingAddress,
        })
      }

      // Generate order code if not provided
      if (!orderData.orderCode) {
        orderData.orderCode = this.generateOrderCode()
      }

      // Create a proper domain entity
      const order = new Order(orderData)

      const createdOrder = await this.orderRepository.create(order)

      // 💰 BILLING: If order is created as CONFIRMED, track NEW_ORDER billing (€1.50)
      if (createdOrder.status === OrderStatus.CONFIRMED) {
        try {
          await this.billingService.trackNewOrder(
            createdOrder.workspaceId,
            createdOrder.customerId,
            `Order ${createdOrder.orderCode} confirmed at creation`
          )
          logger.info(
            `[BILLING] 💰 New order created as CONFIRMED: €1.50 charged for order ${createdOrder.orderCode} (customer: ${createdOrder.customerId})`
          )
        } catch (billingError) {
          logger.error(
            `[BILLING] ❌ Failed to track new order billing for order ${createdOrder.id}:`,
            billingError
          )
          // Don't fail the order creation if billing fails
        }
      }

      return createdOrder
    } catch (error) {
      logger.error("Error in order service createOrder:", error)
      throw new Error(`Failed to create order: ${(error as Error).message}`)
    }
  }

  async updateOrder(
    id: string,
    orderData: Partial<Order>,
    workspaceId: string
  ): Promise<Order | null> {
    try {
      if (!id) {
        throw new Error("Order ID is required")
      }

      // Check if order exists and get current status
      const existingOrder = await this.orderRepository.findById(id, workspaceId)
      if (!existingOrder) {
        throw new Error("Order not found")
      }

      // Determine the final status (after update)
      const finalStatus = orderData.status || existingOrder.status

      // Block modification of order items if FINAL status is NOT PENDING or PROCESSING
      if (
        finalStatus !== "PENDING" &&
        finalStatus !== "PROCESSING" &&
        orderData.items !== undefined
      ) {
        // Check if items have actually changed
        const existingItemIds = existingOrder.items
          .map((item: any) => item.id)
          .sort()
        const newItemIds = orderData.items
          .map((item: any) => item.id || "new")
          .sort()

        const itemsCountChanged =
          existingOrder.items.length !== orderData.items.length
        const itemsIdsChanged =
          JSON.stringify(existingItemIds) !== JSON.stringify(newItemIds)

        // Check if quantities have changed
        let quantitiesChanged = false
        if (!itemsCountChanged && !itemsIdsChanged) {
          for (const newItem of orderData.items) {
            const existingItem = existingOrder.items.find(
              (item: any) => item.id === newItem.id
            )
            if (existingItem && existingItem.quantity !== newItem.quantity) {
              quantitiesChanged = true
              break
            }
          }
        }

        if (itemsCountChanged || itemsIdsChanged || quantitiesChanged) {
          throw new Error(
            `Cannot modify order items when status is ${finalStatus}. Only PENDING and PROCESSING orders can have items modified.`
          )
        }
      }

      // Check if totalAmount is valid when provided
      if (orderData.totalAmount !== undefined && orderData.totalAmount <= 0) {
        throw new Error("Total amount must be greater than 0")
      }

      return await this.orderRepository.update(id, orderData, workspaceId)
    } catch (error) {
      logger.error(`Error in order service updateOrder for order ${id}:`, error)
      throw new Error(`Failed to update order: ${(error as Error).message}`)
    }
  }

  async deleteOrder(id: string, workspaceId: string): Promise<void> {
    try {
      if (!id) {
        throw new Error("Order ID is required")
      }

      // Check if order exists
      const order = await this.orderRepository.findById(id, workspaceId)
      if (!order) {
        throw new Error("Order not found")
      }

      // Allow deletion of all orders regardless of status
      await this.orderRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error in order service deleteOrder for order ${id}:`, error)
      throw new Error(`Failed to delete order: ${(error as Error).message}`)
    }
  }

  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    workspaceId: string
  ): Promise<Order | null> {
    try {
      if (!id) {
        throw new Error("Order ID is required")
      }

      // Check if order exists
      const order = await this.orderRepository.findById(id, workspaceId)
      if (!order) {
        throw new Error("Order not found")
      }

      // Validate status transitions
      if (!this.isValidStatusTransition(order.status, status)) {
        throw new Error(
          `Invalid status transition from ${order.status} to ${status}`
        )
      }

      const oldStatus = order.status

      // Update order status
      const updatedOrder = await this.orderRepository.updateStatus(
        id,
        status,
        workspaceId
      )

      // Handle stock management and notifications
      if (updatedOrder) {
        await this.stockService.handleOrderStatusChange(id, oldStatus, status)

        // 💰 BILLING: Track NEW_ORDER when status becomes CONFIRMED (€1.50)
        if (
          status === OrderStatus.CONFIRMED &&
          oldStatus !== OrderStatus.CONFIRMED
        ) {
          try {
            const customerId = updatedOrder.customerId
            if (customerId) {
              await this.billingService.trackNewOrder(
                workspaceId,
                customerId,
                `Order ${updatedOrder.orderCode} confirmed`
              )
              logger.info(
                `[BILLING] 💰 New order confirmed: €1.50 charged for order ${updatedOrder.orderCode} (customer: ${customerId})`
              )
            } else {
              logger.warn(
                `[BILLING] ⚠️ Cannot track order billing: no customer ID for order ${updatedOrder.orderCode}`
              )
            }
          } catch (billingError) {
            logger.error(
              `[BILLING] ❌ Failed to track new order billing for order ${id}:`,
              billingError
            )
            // Don't fail the order status update if billing fails
          }
        }
      }

      return updatedOrder
    } catch (error) {
      logger.error(
        `Error in order service updateOrderStatus for order ${id}:`,
        error
      )
      throw new Error(
        `Failed to update order status: ${(error as Error).message}`
      )
    }
  }

  // Payment status is now handled by PaymentDetails table

  async getOrdersByDateRange(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Order[]> {
    try {
      if (!startDate || !endDate) {
        throw new Error("Start date and end date are required")
      }

      if (startDate > endDate) {
        throw new Error("Start date must be before end date")
      }

      return await this.orderRepository.getOrdersByDateRange(
        workspaceId,
        startDate,
        endDate
      )
    } catch (error) {
      logger.error("Error in order service getOrdersByDateRange:", error)
      throw new Error(
        `Failed to get orders by date range: ${(error as Error).message}`
      )
    }
  }

  async getOrdersCount(
    workspaceId: string,
    filters?: OrderFilters
  ): Promise<number> {
    try {
      return await this.orderRepository.getOrdersCount(workspaceId, filters)
    } catch (error) {
      logger.error("Error in order service getOrdersCount:", error)
      throw new Error(`Failed to get orders count: ${(error as Error).message}`)
    }
  }

  async getTotalRevenue(
    workspaceId: string,
    filters?: OrderFilters
  ): Promise<number> {
    try {
      return await this.orderRepository.getTotalRevenue(workspaceId, filters)
    } catch (error) {
      logger.error("Error in order service getTotalRevenue:", error)
      throw new Error(
        `Failed to get total revenue: ${(error as Error).message}`
      )
    }
  }

  private generateOrderCode(): string {
    // Generate 5 random uppercase letters
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let orderCode = ""

    for (let i = 0; i < 5; i++) {
      orderCode += letters.charAt(Math.floor(Math.random() * letters.length))
    }

    return orderCode
  }

  private isValidStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus
  ): boolean {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [], // No transitions from delivered
      // Can move to fully delivered when payment is complete
      [OrderStatus.CANCELLED]: [], // No transitions from cancelled
    }

    return validTransitions[currentStatus]?.includes(newStatus) || false
  }

  /**
   * Get order analytics for dashboard
   * @param workspaceId Workspace ID
   * @param filters Optional filters
   * @returns Order analytics data
   */
  async getOrderAnalytics(workspaceId: string, filters?: OrderFilters) {
    try {
      const [totalOrders, totalRevenue, pendingOrders, completedOrders] =
        await Promise.all([
          this.orderRepository.getOrdersCount(workspaceId, filters),
          this.orderRepository.getTotalRevenue(workspaceId, filters),
          this.orderRepository.getOrdersCount(workspaceId, {
            ...filters,
            status: OrderStatus.PENDING,
          }),
          this.orderRepository.getOrdersCount(workspaceId, {
            ...filters,
            status: OrderStatus.DELIVERED,
          }),
        ])

      return {
        totalOrders,
        totalRevenue,
        pendingOrders,
        completedOrders,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      }
    } catch (error) {
      logger.error("Error in order service getOrderAnalytics:", error)
      throw new Error(
        `Failed to get order analytics: ${(error as Error).message}`
      )
    }
  }

  async getLatestProcessingTracking(
    workspaceId: string,
    customerId: string
  ): Promise<{
    orderId: string
    orderCode: string
    status: OrderStatus
    trackingNumber: string | null
    trackingUrl: string | null
  } | null> {
    try {
      if (!workspaceId || !customerId) {
        throw new Error("workspaceId and customerId are required")
      }
      const order = await this.orderRepository.findLatestProcessingByCustomer(
        customerId,
        workspaceId
      )
      if (!order) {
        return null
      }
      const { buildDhlTrackingUrl } = await import("../../config")
      const trackingUrl = buildDhlTrackingUrl(order.trackingNumber)
      return {
        orderId: order.id,
        orderCode: order.orderCode,
        status: order.status,
        trackingNumber: order.trackingNumber || null,
        trackingUrl,
      }
    } catch (error) {
      logger.error("Error in getLatestProcessingTracking:", error)
      throw error
    }
  }
}
