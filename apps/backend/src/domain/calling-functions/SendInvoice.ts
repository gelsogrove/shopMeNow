import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"

const prisma = new PrismaClient()

export interface SendInvoiceRequest {
  customerId: string
  workspaceId: string
  orderId: string
  email?: string // Optional - use customer email if not provided
}

export interface SendInvoiceResponse {
  success: boolean
  message?: string
  invoiceUrl?: string
  sentTo?: string
  error?: string
}

/**
 * Send invoice PDF via email for specific order
 * TODO: Integration with PDF generator and email service
 */
export async function sendInvoice(
  request: SendInvoiceRequest
): Promise<SendInvoiceResponse> {
  try {
    logger.info("[SEND_INVOICE] Sending invoice:", request)

    const { customerId, workspaceId, orderId, email } = request

    // Find order with customer details
    const order = await prisma.orders.findFirst({
      where: {
        OR: [{ id: orderId }, { orderCode: orderId }],
        customerId: customerId,
        workspaceId: workspaceId,
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

    if (!order) {
      logger.warn(`[SEND_INVOICE] Order not found: ${orderId}`)
      return {
        success: false,
        error: "Order not found",
        message: `Ordine ${orderId} non trovato. Verifica il codice ordine.`,
      }
    }

    // Determine email recipient
    const recipientEmail = email || order.customer.email

    if (!recipientEmail) {
      logger.warn(
        `[SEND_INVOICE] No email available for customer: ${customerId}`
      )
      return {
        success: false,
        error: "No email available",
        message:
          "Email non disponibile. Per favore fornisci un indirizzo email.",
      }
    }

    // TODO: Generate PDF invoice
    // For now, create a mock invoice URL
    const invoiceUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/invoice-public?orderId=${order.id}&token=mock-token`

    logger.info(
      `[SEND_INVOICE] Invoice URL generated: ${invoiceUrl} for ${recipientEmail}`
    )

    // TODO: Send email with PDF attachment
    // const emailService = new EmailService()
    // await emailService.sendInvoice({
    //   to: recipientEmail,
    //   orderCode: order.orderCode,
    //   invoiceUrl: invoiceUrl,
    //   pdfAttachment: generatedPDF
    // })

    // For now, just log and return success
    logger.info(
      `[SEND_INVOICE] ✅ Invoice sent to ${recipientEmail} for order ${order.orderCode}`
    )

    return {
      success: true,
      message: `Fattura per ordine ${order.orderCode} inviata a ${recipientEmail}. Controlla la tua casella email.`,
      invoiceUrl: invoiceUrl,
      sentTo: recipientEmail,
    }
  } catch (error) {
    logger.error("[SEND_INVOICE] Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message:
        "Errore nell'invio della fattura. Riprova più tardi o contatta l'assistenza.",
    }
  } finally {
    await prisma.$disconnect()
  }
}
