import { OrderStatus, Prisma, PrismaClient } from "@prisma/client"
import { Order } from "../domain/entities/order.entity"
import {
  IOrderRepository,
  OrderFilters,
  PaginatedOrders,
} from "../domain/repositories/order.repository.interface"
import logger from "../utils/logger"

export class OrderRepository implements IOrderRepository {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  async findAll(
    workspaceId: string,
    filters?: OrderFilters
  ): Promise<PaginatedOrders> {
    try {
      logger.info("OrderRepository.findAll called with:", {
        workspaceId,
        filters,
      })

      const where: Prisma.OrdersWhereInput = {
        workspaceId,
      }

      // Search filter (order code or customer name)
      if (filters?.search) {
        where.OR = [
          { orderCode: { contains: filters.search, mode: "insensitive" } },
          {
            customer: {
              name: { contains: filters.search, mode: "insensitive" },
            },
          },
        ]
      }

      // Customer filter
      if (filters?.customerId) {
        where.customerId = filters.customerId
      }

      // Status filter
      if (filters?.status) {
        where.status = filters.status
      }

      // Payment status is now handled via PaymentDetails table

      // Date range filter
      if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) {
          where.createdAt.gte = filters.dateFrom
        }
        if (filters.dateTo) {
          where.createdAt.lte = filters.dateTo
        }
      }

      const page = filters?.page || 1
      const limit = filters?.limit || 50
      const skip = (page - 1) * limit

      // Count total orders
      const total = await this.prisma.orders.count({ where })
      const totalPages = Math.ceil(total / limit)

      if (total === 0) {
        return {
          orders: [],
          total: 0,
          page,
          totalPages: 0,
        }
      }

      // Get orders with related data
      const ordersData = await this.prisma.orders.findMany({
        where,
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      })

      const orders = ordersData.map((data) => this.mapToDomainEntity(data))

      return {
        orders,
        total,
        page,
        totalPages,
      }
    } catch (error) {
      logger.error("Error in findAll:", error)
      return {
        orders: [],
        total: 0,
        page: filters?.page || 1,
        totalPages: 0,
      }
    }
  }

  async findById(id: string, workspaceId: string): Promise<Order | null> {
    try {
      const order = await this.prisma.orders.findFirst({
        where: {
          id,
          workspaceId,
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
      })

      if (!order) return null
      return this.mapToDomainEntity(order)
    } catch (error) {
      logger.error(`Error in findById for order ${id}:`, error)
      return null
    }
  }

  async findByOrderCode(
    orderCode: string,
    workspaceId: string
  ): Promise<Order | null> {
    try {
      const order = await this.prisma.orders.findFirst({
        where: {
          orderCode,
          workspaceId,
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
      })

      if (!order) return null
      return this.mapToDomainEntity(order)
    } catch (error) {
      logger.error(`Error in findByOrderCode for order ${orderCode}:`, error)
      return null
    }
  }

  async findByCustomerId(
    customerId: string,
    workspaceId: string
  ): Promise<Order[]> {
    try {
      const orders = await this.prisma.orders.findMany({
        where: {
          customerId,
          workspaceId,
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      return orders.map((order) => this.mapToDomainEntity(order))
    } catch (error) {
      logger.error(
        `Error in findByCustomerId for customer ${customerId}:`,
        error
      )
      return []
    }
  }

  async findLatestProcessingByCustomer(
    customerId: string,
    workspaceId: string
  ): Promise<Order | null> {
    try {
      const data = await this.prisma.orders.findFirst({
        where: {
          customerId,
          workspaceId,
          status: OrderStatus.PROCESSING,
        },
        orderBy: { createdAt: "desc" },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              service: true, // ✅ Include services
            },
          },
        },
      })
      return data ? this.mapToDomainEntity(data) : null
    } catch (error) {
      logger.error(
        `Error in findLatestProcessingByCustomer for customer ${customerId}:`,
        error
      )
      return null
    }
  }

  async create(order: Order): Promise<Order> {
    try {
      const createdOrder = await this.prisma.orders.create({
        data: {
          orderCode: order.orderCode,
          customerId: order.customerId,
          workspaceId: order.workspaceId,
          status: order.status,
          paymentMethod: order.paymentMethod,
          totalAmount: order.totalAmount,
          shippingAmount: order.shippingAmount,
          taxAmount: order.taxAmount,
          shippingAddress: order.shippingAddress as any,
          billingAddress: order.billingAddress as any,
          notes: order.notes,
          discountCode: order.discountCode,
          discountAmount: order.discountAmount,
          trackingNumber: order.trackingNumber || null, // optional
          items: {
            create:
              order.items?.map((item) => ({
                itemType: item.itemType || "PRODUCT",
                productId: item.productId,
                serviceId: item.serviceId || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                productVariant: item.productVariant as any,
              })) || [],
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              service: true, // ✅ Include services
            },
          },
        },
      })

      return this.mapToDomainEntity(createdOrder)
    } catch (error) {
      logger.error("Error creating order:", error)
      throw new Error(`Failed to create order: ${(error as Error).message}`)
    }
  }

  async update(
    id: string,
    order: Partial<Order>,
    workspaceId: string
  ): Promise<Order | null> {
    try {
      // Prepare update data
      const updateData: any = {
        status: order.status,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
        shippingAmount: order.shippingAmount,
        taxAmount: order.taxAmount,
        shippingAddress: order.shippingAddress as any,
        billingAddress: order.billingAddress as any,
        notes: order.notes,
        discountCode: order.discountCode,
        discountAmount: order.discountAmount,
        trackingNumber: order.trackingNumber ?? undefined,
        updatedAt: new Date(),
      }

      // Handle items update efficiently
      if (order.items && Array.isArray(order.items)) {
        logger.info(`Updating order ${id} with ${order.items.length} items`)

        // Delete existing items and create new ones in a transaction
        await this.prisma.orderItems.deleteMany({
          where: { orderId: id },
        })

        updateData.items = {
          create: order.items.map((item) => ({
            itemType: item.itemType || "PRODUCT",
            productId: item.productId,
            serviceId: item.serviceId || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            productVariant: item.productVariant as any,
          })),
        }
      }

      const updatedOrder = await this.prisma.orders.update({
        where: {
          id,
          workspaceId,
        },
        data: updateData,
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              service: true, // ✅ Include services
            },
          },
        },
      })

      logger.info(`Order ${id} updated successfully`)
      return this.mapToDomainEntity(updatedOrder)
    } catch (error) {
      logger.error(`Error updating order ${id}:`, error)
      return null
    }
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    try {
      // First delete all order items associated with this order
      await this.prisma.orderItems.deleteMany({
        where: {
          orderId: id,
        },
      })

      // Then delete the order itself
      await this.prisma.orders.delete({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error deleting order ${id}:`, error)
      throw new Error(`Failed to delete order: ${(error as Error).message}`)
    }
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    workspaceId: string
  ): Promise<Order | null> {
    try {
      const updatedOrder = await this.prisma.orders.update({
        where: {
          id,
          workspaceId,
        },
        data: {
          status,
          updatedAt: new Date(),
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              service: true, // ✅ Include services
            },
          },
        },
      })

      return this.mapToDomainEntity(updatedOrder)
    } catch (error) {
      logger.error(`Error updating status for order ${id}:`, error)
      return null
    }
  }

  async getOrdersByDateRange(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Order[]> {
    try {
      const orders = await this.prisma.orders.findMany({
        where: {
          workspaceId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              service: true, // ✅ Include services
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      return orders.map((order) => this.mapToDomainEntity(order))
    } catch (error) {
      logger.error("Error getting orders by date range:", error)
      return []
    }
  }

  async getOrdersCount(
    workspaceId: string,
    filters?: OrderFilters
  ): Promise<number> {
    try {
      const where: Prisma.OrdersWhereInput = {
        workspaceId,
      }

      if (filters?.status) {
        where.status = filters.status
      }

      // Payment status filtering removed

      if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) {
          where.createdAt.gte = filters.dateFrom
        }
        if (filters.dateTo) {
          where.createdAt.lte = filters.dateTo
        }
      }

      return await this.prisma.orders.count({ where })
    } catch (error) {
      logger.error("Error counting orders:", error)
      return 0
    }
  }

  async getTotalRevenue(
    workspaceId: string,
    filters?: OrderFilters
  ): Promise<number> {
    try {
      const where: Prisma.OrdersWhereInput = {
        workspaceId,
        // Payment status removed
      }

      if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) {
          where.createdAt.gte = filters.dateFrom
        }
        if (filters.dateTo) {
          where.createdAt.lte = filters.dateTo
        }
      }

      const result = await this.prisma.orders.aggregate({
        where,
        _sum: {
          totalAmount: true,
        },
      })

      return result._sum.totalAmount || 0
    } catch (error) {
      logger.error("Error calculating total revenue:", error)
      return 0
    }
  }

  private mapToDomainEntity(data: any): Order {
    return new Order({
      id: data.id,
      orderCode: data.orderCode,
      customerId: data.customerId,
      workspaceId: data.workspaceId,
      status: data.status,
      // Payment status removed
      paymentMethod: data.paymentMethod,
      totalAmount: data.totalAmount,
      shippingAmount: data.shippingAmount,
      taxAmount: data.taxAmount,
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress,
      notes: data.notes,
      discountCode: data.discountCode,
      discountAmount: data.discountAmount,
      trackingNumber: data.trackingNumber,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      customer: data.customer,
      items:
        data.items?.map((item: any) => ({
          id: item.id,
          orderId: item.orderId,
          itemType: item.itemType, // ✅ AGGIUNTO
          productId: item.productId,
          serviceId: item.serviceId, // ✅ AGGIUNTO
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          productVariant: item.productVariant,
          product: item.product,
          service: item.service, // ✅ AGGIUNTO
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })) || [],
    })
  }
}
