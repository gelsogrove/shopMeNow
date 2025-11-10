import { PrismaClient } from "@prisma/client"
import logger from "../../utils/logger"

const prisma = new PrismaClient()

export interface GetOrderRequest {
  customerId: string
  workspaceId: string
  orderId: string
}

export interface GetOrderResponse {
  success: boolean
  order?: {
    id: string
    orderCode: string
    status: string
    totalAmount: number
    currency: string
    createdAt: string
    deliveryDate?: string
    shippingAddress?: any
    billingAddress?: any
    items: Array<{
      id: string
      productId?: string
      serviceId?: string
      name: string
      quantity: number
      price: number
      total: number
    }>
    tracking?: {
      trackingNumber?: string
      carrier?: string
      status?: string
    }
  }
  message?: string
  error?: string
}

/**
 * Get specific order details by order ID or order code
 */
export async function getOrder(
  request: GetOrderRequest
): Promise<GetOrderResponse> {
  try {
    logger.info("[GET_ORDER] Fetching order:", request)

    const { customerId, workspaceId, orderId } = request

    // Find order by ID or orderCode
    const order = await prisma.orders.findFirst({
      where: {
        OR: [{ id: orderId }, { orderCode: orderId }],
        customerId: customerId,
        workspaceId: workspaceId,
      },
      include: {
        items: {
          include: {
            product: true,
            service: true,
          },
        },
        customer: true,
      },
    })

    if (!order) {
      logger.warn(`[GET_ORDER] Order not found: ${orderId}`)
      return {
        success: false,
        error: "Order not found",
        message: `Ordine ${orderId} non trovato. Verifica il codice ordine e riprova.`,
      }
    }

    // Format order items
    const formattedItems = order.items.map((item) => ({
      id: item.id,
      productId: item.productId || undefined,
      serviceId: item.serviceId || undefined,
      name: item.product?.name || item.service?.name || "Unknown",
      quantity: item.quantity,
      price: item.unitPrice,
      total: item.totalPrice,
    }))

    // Format response
    const orderData = {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status || "PENDING",
      totalAmount: order.totalAmount,
      currency: order.customer?.currency || "EUR",
      createdAt: order.createdAt.toISOString(),
      deliveryDate: undefined, // Not in schema yet
      shippingAddress: order.shippingAddress || undefined,
      billingAddress: order.billingAddress || undefined,
      items: formattedItems,
      tracking: order.trackingNumber
        ? {
            trackingNumber: order.trackingNumber,
            carrier: undefined, // Not in schema yet
            status: undefined, // Not in schema yet
          }
        : undefined,
    }

    logger.info(`[GET_ORDER] Order found: ${order.orderCode}`)

    return {
      success: true,
      order: orderData,
      message: `Ordine ${order.orderCode} trovato con successo.`,
    }
  } catch (error) {
    logger.error("[GET_ORDER] Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message:
        "Errore nel recupero dell'ordine. Riprova più tardi o contatta l'assistenza.",
    }
  } finally {
    await prisma.$disconnect()
  }
}
