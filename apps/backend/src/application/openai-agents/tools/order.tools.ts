/**
 * OpenAI Agents SDK - Order Tools
 * 
 * Tools for order management: create order, track orders, view history.
 * 
 * @architecture Clean Architecture - Tools layer
 * @security ALL queries filtered by workspaceId AND customerId
 * @critical NO hardcoded data - all from database
 */

import { tool } from "@openai/agents"
import { z } from "zod"
import { AgentContext, OrderResult, ToolResult } from "../types"
import logger from "../../../utils/logger"

/**
 * Get customer's orders
 */
export const getOrdersTool = tool({
  name: "get_orders",
  description: `Get the customer's order history.
    Use this when the customer asks about their orders, purchases, or order history.`,
  parameters: z.object({
    status: z.string().optional().describe("Filter by order status: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED"),
    limit: z.number().default(10).describe("Maximum number of orders to return"),
  }),
  execute: async ({ status, limit }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      logger.info(`📦 [getOrders] Customer: ${ctx.customerId}, Status: ${status || "all"}`)
      
      const whereClause: any = {
        customerId: ctx.customerId,
        workspaceId: ctx.workspaceId,
        deletedAt: null,
      }
      
      if (status) {
        whereClause.status = status.toUpperCase()
      }
      
      const orders = await ctx.prisma.orders.findMany({
        where: whereClause,
        include: {
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      })
      
      const results: OrderResult[] = orders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        status: o.status,
        paymentStatus: o.paymentStatus || undefined,
        totalAmount: Number(o.totalAmount),
        shippingAmount: o.shippingAmount ? Number(o.shippingAmount) : undefined,
        taxAmount: o.taxAmount ? Number(o.taxAmount) : undefined,
        discountAmount: o.discountAmount ? Number(o.discountAmount) : undefined,
        items: o.items.map((item) => ({
          productName: item.product?.name,
          serviceName: item.service?.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
        createdAt: o.createdAt,
        trackingNumber: o.trackingNumber || undefined,
        notes: o.notes || undefined,
      }))
      
      return {
        success: true,
        data: results,
        message: results.length > 0 
          ? `Trovati ${results.length} ordini` 
          : "Nessun ordine trovato",
      } as ToolResult<OrderResult[]>
      
    } catch (error) {
      logger.error(`❌ [getOrders] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero degli ordini",
      } as ToolResult<OrderResult[]>
    }
  },
})

/**
 * Get order details by code
 */
export const getOrderDetailsTool = tool({
  name: "get_order_details",
  description: `Get detailed information about a specific order.
    Use this when the customer asks about a specific order or order code.`,
  parameters: z.object({
    orderCode: z.string().describe("Order code (e.g., ORD-2024-001)"),
  }),
  execute: async ({ orderCode }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      logger.info(`📦 [getOrderDetails] Order: ${orderCode}`)
      
      const order = await ctx.prisma.orders.findFirst({
        where: {
          orderCode,
          customerId: ctx.customerId,
          workspaceId: ctx.workspaceId,
          deletedAt: null,
        },
        include: {
          items: {
            include: {
              product: true,
              service: true,
            },
          },
          paymentDetails: true,
        },
      })
      
      if (!order) {
        return {
          success: false,
          error: "Order not found",
          message: "Ordine non trovato. Verifica il codice ordine.",
        } as ToolResult<OrderResult>
      }
      
      return {
        success: true,
        data: {
          id: order.id,
          orderCode: order.orderCode,
          status: order.status,
          paymentStatus: order.paymentStatus || undefined,
          totalAmount: Number(order.totalAmount),
          shippingAmount: order.shippingAmount ? Number(order.shippingAmount) : undefined,
          taxAmount: order.taxAmount ? Number(order.taxAmount) : undefined,
          discountAmount: order.discountAmount ? Number(order.discountAmount) : undefined,
          items: order.items.map((item) => ({
            productName: item.product?.name,
            serviceName: item.service?.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          })),
          createdAt: order.createdAt,
          trackingNumber: order.trackingNumber || undefined,
          notes: order.notes || undefined,
        },
        message: `Dettagli ordine ${orderCode}`,
      } as ToolResult<OrderResult>
      
    } catch (error) {
      logger.error(`❌ [getOrderDetails] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero dettagli ordine",
      } as ToolResult<OrderResult>
    }
  },
})

/**
 * Create order from cart
 */
export const createOrderFromCartTool = tool({
  name: "create_order_from_cart",
  description: `Create an order from the customer's current cart.
    Use this when the customer confirms they want to place an order.`,
  parameters: z.object({
    notes: z.string().optional().describe("Optional notes for the order"),
    paymentMethod: z.enum(["BANK_TRANSFER", "CREDIT_CARD", "PAYPAL", "CASH_ON_DELIVERY"]).optional().describe("Payment method"),
  }),
  execute: async ({ notes, paymentMethod }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      logger.info(`📦 [createOrderFromCart] Creating order for customer: ${ctx.customerId}`)
      
      // Get cart
      const cart = await ctx.prisma.carts.findUnique({
        where: { customerId: ctx.customerId },
        include: {
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
      })
      
      if (!cart || cart.workspaceId !== ctx.workspaceId) {
        return {
          success: false,
          error: "Cart not found",
          message: "Carrello non trovato",
        } as ToolResult<OrderResult>
      }
      
      if (cart.items.length === 0) {
        return {
          success: false,
          error: "Cart is empty",
          message: "Il carrello è vuoto. Aggiungi prodotti prima di ordinare.",
        } as ToolResult<OrderResult>
      }
      
      // Calculate totals
      let subtotal = 0
      const orderItems: any[] = []
      
      for (const item of cart.items) {
        const unitPrice = Number(item.product?.price || item.service?.price || 0)
        const totalPrice = unitPrice * item.quantity
        subtotal += totalPrice
        
        // Verify stock
        if (item.product && item.product.stock < item.quantity) {
          return {
            success: false,
            error: "Insufficient stock",
            message: `Stock insufficiente per "${item.product.name}". Disponibili: ${item.product.stock}`,
          } as ToolResult<OrderResult>
        }
        
        orderItems.push({
          productId: item.productId,
          serviceId: item.serviceId,
          itemType: item.itemType,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        })
      }
      
      const customerDiscount = ctx.customerDiscount || 0
      const discountAmount = customerDiscount > 0 ? subtotal * (customerDiscount / 100) : 0
      const totalAmount = subtotal - discountAmount
      
      // Generate order code
      const year = new Date().getFullYear()
      const lastOrder = await ctx.prisma.orders.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          orderCode: { startsWith: `ORD-${year}` },
        },
        orderBy: { createdAt: "desc" },
      })
      
      let orderNumber = 1
      if (lastOrder) {
        const parts = lastOrder.orderCode.split("-")
        orderNumber = parseInt(parts[2] || "0", 10) + 1
      }
      const orderCode = `ORD-${year}-${orderNumber.toString().padStart(4, "0")}`
      
      // Create order in transaction
      const order = await ctx.prisma.$transaction(async (tx) => {
        // Create order
        const newOrder = await tx.orders.create({
          data: {
            orderCode,
            customerId: ctx.customerId,
            workspaceId: ctx.workspaceId,
            status: "PENDING",
            paymentStatus: "PENDING",
            paymentMethod: paymentMethod || null,
            totalAmount,
            discountAmount,
            notes,
            items: {
              create: orderItems,
            },
          },
          include: {
            items: {
              include: {
                product: true,
                service: true,
              },
            },
          },
        })
        
        // Update stock for products (with workspace isolation)
        for (const item of cart.items) {
          if (item.productId && item.product) {
            await tx.products.update({
              where: { id: item.productId, workspaceId: ctx.workspaceId },
              data: { stock: item.product.stock - item.quantity },
            })
          }
        }
        
        // Clear cart
        await tx.cartItems.deleteMany({ where: { cartId: cart.id } })
        
        return newOrder
      })
      
      logger.info(`✅ [createOrderFromCart] Order created: ${orderCode}`)
      
      return {
        success: true,
        data: {
          id: order.id,
          orderCode: order.orderCode,
          status: order.status,
          paymentStatus: order.paymentStatus || undefined,
          totalAmount: Number(order.totalAmount),
          discountAmount: order.discountAmount ? Number(order.discountAmount) : undefined,
          items: order.items.map((item) => ({
            productName: item.product?.name,
            serviceName: item.service?.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          })),
          createdAt: order.createdAt,
          notes: order.notes || undefined,
        },
        message: `Ordine ${orderCode} creato con successo!`,
      } as ToolResult<OrderResult>
      
    } catch (error) {
      logger.error(`❌ [createOrderFromCart] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nella creazione dell'ordine",
      } as ToolResult<OrderResult>
    }
  },
})

/**
 * Repeat a previous order
 */
export const repeatOrderTool = tool({
  name: "repeat_order",
  description: `Repeat a previous order by adding all its items to the cart.
    Use this when the customer wants to order the same products again.`,
  parameters: z.object({
    orderCode: z.string().describe("Order code to repeat"),
  }),
  execute: async ({ orderCode }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      logger.info(`📦 [repeatOrder] Repeating order: ${orderCode}`)
      
      const order = await ctx.prisma.orders.findFirst({
        where: {
          orderCode,
          customerId: ctx.customerId,
          workspaceId: ctx.workspaceId,
          deletedAt: null,
        },
        include: {
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
      })
      
      if (!order) {
        return {
          success: false,
          error: "Order not found",
          message: "Ordine non trovato",
        } as ToolResult<string>
      }
      
      // Find or create cart
      let cart = await ctx.prisma.carts.findUnique({
        where: { customerId: ctx.customerId },
      })
      
      if (!cart) {
        cart = await ctx.prisma.carts.create({
          data: {
            customerId: ctx.customerId,
            workspaceId: ctx.workspaceId,
          },
        })
      }
      
      // Add items to cart
      let addedCount = 0
      let unavailableItems: string[] = []
      
      for (const item of order.items) {
        if (item.productId && item.product?.isActive) {
          if (item.product.stock >= item.quantity) {
            await ctx.prisma.cartItems.create({
              data: {
                cartId: cart.id,
                productId: item.productId,
                itemType: "PRODUCT",
                quantity: item.quantity,
              },
            })
            addedCount++
          } else {
            unavailableItems.push(item.product.name)
          }
        } else if (item.serviceId && item.service?.isActive) {
          await ctx.prisma.cartItems.create({
            data: {
              cartId: cart.id,
              serviceId: item.serviceId,
              itemType: "SERVICE",
              quantity: item.quantity,
            },
          })
          addedCount++
        }
      }
      
      let message = `Aggiunti ${addedCount} articoli al carrello dall'ordine ${orderCode}`
      if (unavailableItems.length > 0) {
        message += `. Non disponibili: ${unavailableItems.join(", ")}`
      }
      
      return {
        success: true,
        data: message,
        message,
      } as ToolResult<string>
      
    } catch (error) {
      logger.error(`❌ [repeatOrder] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel ripetere l'ordine",
      } as ToolResult<string>
    }
  },
})

/**
 * Get order tracking link
 */
export const getOrderLinkTool = tool({
  name: "get_order_link",
  description: `Generate a secure link for the customer to view their orders.
    Use this when the customer wants to see their orders in the browser.`,
  parameters: z.object({
    orderCode: z.string().optional().describe("Specific order code (optional)"),
  }),
  execute: async ({ orderCode }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      const { SecureTokenService } = await import("../../services/secure-token.service")
      const secureTokenService = new SecureTokenService()
      
      const token = await secureTokenService.createToken(
        "orders",
        ctx.workspaceId,
        undefined,  // payload
        "1h",       // expiresIn
        undefined,  // userId
        undefined,  // phoneNumber
        undefined,  // ipAddress
        ctx.customerId
      )
      
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000"
      let ordersUrl = `${baseUrl}/orders-public?token=${token}`
      
      if (orderCode) {
        ordersUrl = `${baseUrl}/orders-public/${orderCode}?token=${token}`
      }
      
      return {
        success: true,
        data: ordersUrl,
        message: "Link ordini generato (valido 1 ora)",
      } as ToolResult<string>
      
    } catch (error) {
      logger.error(`❌ [getOrderLink] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nella generazione del link ordini",
      } as ToolResult<string>
    }
  },
})

// Export all order tools
export const orderTools = [
  getOrdersTool,
  getOrderDetailsTool,
  createOrderFromCartTool,
  repeatOrderTool,
  getOrderLinkTool,
]
