/**
 * GetShipmentTrackingLink - LLM-Callable Function
 *
 * Genera un link DHL per tracciare la spedizione di un ordine.
 * Utilizzata quando l'utente chiede: "dov'è il mio ordine?", "tracking spedizione", etc.
 *
 * @see docs/prompt_agent.md - Line 210: Definizione della calling function
 */

import logger from "../../utils/logger"

export interface GetShipmentTrackingLinkRequest {
  customerId: string
  workspaceId: string
  orderCode?: string // Se non specificato, usa ultimo ordine del cliente
}

export interface GetShipmentTrackingLinkResult {
  success: boolean
  linkUrl?: string
  trackingNumber?: string
  orderCode?: string
  expiresAt?: string
  action?: string
  timestamp: string
  error?: string
  message?: string
}

/**
 * Generates DHL tracking link for order shipment
 *
 * @param request - Request parameters
 * @returns Short URL redirecting to DHL tracking page
 */
export async function GetShipmentTrackingLink(
  request: GetShipmentTrackingLinkRequest
): Promise<GetShipmentTrackingLinkResult> {
  try {
    logger.info("📦 GetShipmentTrackingLink called with:", request)
    const { PrismaClient } = require("@prisma/client")
    const prisma = new PrismaClient()

    try {
      // Query the database for the order with trackingNumber
      // If no orderCode provided, get the last order for the customer
      const whereClause = request.orderCode
        ? { orderCode: request.orderCode, workspaceId: request.workspaceId }
        : { customerId: request.customerId, workspaceId: request.workspaceId }

      const order = await prisma.orders.findFirst({
        where: whereClause,
        orderBy: { createdAt: "desc" }, // Get most recent if no specific orderCode
        select: {
          orderCode: true,
          trackingNumber: true,
        },
      })

      await prisma.$disconnect()

      if (!order) {
        logger.info("❌ Order not found:", request.orderCode || "ultimo ordine")
        return {
          success: false,
          error: "Ordine non trovato",
          message: "Ordine non trovato",
          timestamp: new Date().toISOString(),
        }
      }

      if (!order.trackingNumber) {
        logger.info("❌ No tracking number for order:", order.orderCode)
        return {
          success: false,
          error: "Non c'è il tracking-id nell'ordine",
          message:
            "Il tracking della spedizione non è ancora disponibile per questo ordine.",
          timestamp: new Date().toISOString(),
        }
      }

      logger.info("✅ Order found with tracking:", order.trackingNumber)
      // Generate direct DHL tracking link
      const dhlTrackingUrl = `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(
        order.trackingNumber
      )}`

      // Create short URL that redirects to DHL
      try {
        const {
          urlShortenerService,
        } = require("../../application/services/url-shortener.service")

        const shortResult = await urlShortenerService.createShortUrl(
          dhlTrackingUrl,
          request.workspaceId
        )

        const shortTrackingUrl = shortResult.shortUrl

        logger.info(`📎 Short tracking link created: ${shortTrackingUrl}`)
        return {
          success: true,
          linkUrl: shortTrackingUrl,
          trackingNumber: order.trackingNumber,
          orderCode: order.orderCode,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          action: "tracking",
          timestamp: new Date().toISOString(),
        }
      } catch (shortError) {
        logger.warn("⚠️ Failed to create short URL, using direct DHL link")
        // Fallback to direct DHL link
        return {
          success: true,
          linkUrl: dhlTrackingUrl,
          trackingNumber: order.trackingNumber,
          orderCode: order.orderCode,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          action: "tracking",
          timestamp: new Date().toISOString(),
        }
      }
    } catch (dbError) {
      logger.error("❌ Database error:", dbError)
      await prisma.$disconnect()

      return {
        success: false,
        error: "Errore database",
        message: "Impossibile recuperare informazioni sull'ordine.",
        timestamp: new Date().toISOString(),
      }
    }
  } catch (error) {
    logger.error("❌ Error in GetShipmentTrackingLink:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore interno",
      message: "Impossibile generare il link di tracking. Riprova più tardi.",
      timestamp: new Date().toISOString(),
    }
  }
}
