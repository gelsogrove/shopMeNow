import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"
import { EmailService } from "../../application/services/email.service"

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

async function generatePdfBuffer(build: (doc: any) => void): Promise<Buffer> {
  const PDFDocument = require("pdfkit")

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    const chunks: Buffer[] = []

    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", (err: unknown) => reject(err))

    build(doc)
    doc.end()
  })
}

async function generateInvoicePdf(params: {
  workspaceName: string
  orderCode: string
  createdAt: Date
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>
  orderTotal: number
}): Promise<Buffer> {
  return generatePdfBuffer((doc) => {
    doc.fontSize(20).font("Helvetica-Bold").text("INVOICE", { align: "center" })
    doc.moveDown(0.5)
    doc.fontSize(10).font("Helvetica").text(params.workspaceName, { align: "center" })
    doc.moveDown(0.5)
    doc.text(`Invoice Number: ${params.orderCode}`, { align: "center" })
    doc.text(`Invoice Date: ${new Date(params.createdAt).toLocaleDateString("en-US")}`, {
      align: "center",
    })

    doc.moveDown(2)
    doc.fontSize(12).font("Helvetica-Bold").text("BILL TO")
    doc.moveDown(0.25)
    doc.fontSize(10).font("Helvetica")
    if (params.customerName) doc.text(params.customerName)
    if (params.customerEmail) doc.text(`Email: ${params.customerEmail}`)
    if (params.customerPhone) doc.text(`Phone: ${params.customerPhone}`)

    doc.moveDown(2)
    doc.fontSize(12).font("Helvetica-Bold").text("ITEMS")
    doc.moveDown(0.5)

    // Simple table header
    doc.fontSize(10).font("Helvetica-Bold")
    doc.text("Item", 50, doc.y, { continued: true })
    doc.text("Qty", 300, doc.y, { width: 50, align: "right", continued: true })
    doc.text("Unit", 360, doc.y, { width: 70, align: "right", continued: true })
    doc.text("Total", 440, doc.y, { width: 100, align: "right" })
    doc.moveDown(0.25)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)

    doc.fontSize(10).font("Helvetica")
    for (const item of params.items) {
      doc.text(item.name, 50, doc.y, { continued: true })
      doc.text(String(item.quantity), 300, doc.y, { width: 50, align: "right", continued: true })
      doc.text(`€${item.unitPrice.toFixed(2)}`, 360, doc.y, { width: 70, align: "right", continued: true })
      doc.text(`€${item.totalPrice.toFixed(2)}`, 440, doc.y, { width: 100, align: "right" })
    }

    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)
    doc.fontSize(12).font("Helvetica-Bold").text(`Grand Total: €${params.orderTotal.toFixed(2)}`, {
      align: "right",
    })
  })
}

async function generateCreditNotePdf(params: {
  workspaceName: string
  orderCode: string
  creditNoteCode: string
  amount: number
  reason: string
  createdAt: Date
}): Promise<Buffer> {
  return generatePdfBuffer((doc) => {
    doc.fontSize(20).font("Helvetica-Bold").text("CREDIT NOTE", { align: "center" })
    doc.moveDown(0.5)
    doc.fontSize(10).font("Helvetica").text(params.workspaceName, { align: "center" })
    doc.moveDown(1)

    doc.fontSize(12).font("Helvetica-Bold").text(`Credit Note: ${params.creditNoteCode}`)
    doc.fontSize(10).font("Helvetica")
    doc.text(`Order: ${params.orderCode}`)
    doc.text(`Date: ${new Date(params.createdAt).toLocaleDateString("en-US")}`)
    doc.text(`Amount: €${params.amount.toFixed(2)}`)
    doc.moveDown(1)
    doc.fontSize(10).font("Helvetica-Bold").text("Reason")
    doc.fontSize(10).font("Helvetica").text(params.reason || "-")
  })
}

/**
 * Send invoice PDF via email for specific order
 * @see Feature 202 - Order Selection & Invoice Actions
 * 
 * PDF naming: {orderCode}_fattura.pdf
 * Credit notes: {orderCode}_notadicredito{N}.pdf
 */
export async function sendInvoice(
  request: SendInvoiceRequest
): Promise<SendInvoiceResponse> {
  try {
    logger.info("[SEND_INVOICE] Sending invoice:", request)

    const { customerId, workspaceId, orderId, email } = request

    // Find order with customer details and credit notes
    const order = await prisma.orders.findFirst({
      where: {
        OR: [{ id: orderId }, { orderCode: orderId }],
        customerId: customerId,
        workspaceId: workspaceId,
      },
      include: {
        customer: true,
        workspace: true,
        items: {
          include: {
            product: true,
            service: true,
          },
        },
        creditNotes: true,
      },
    })

    if (!order) {
      logger.warn(`[SEND_INVOICE] Order not found: ${orderId}`)
      return {
        success: false,
        error: "Order not found",
        message: `Order ${orderId} was not found. Please check the order code.`,
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
        message: "No email is available. Please provide an email address.",
      }
    }

    // Calculate order total
    const orderTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0)

    const workspaceName = order.workspace?.name || "eChatbot"

    const invoicePdf = await generateInvoicePdf({
      workspaceName,
      orderCode: order.orderCode,
      createdAt: order.createdAt,
      customerName: order.customer?.name || undefined,
      customerEmail: order.customer?.email || undefined,
      customerPhone: order.customer?.phone || undefined,
      items: order.items.map((it) => ({
        name: it.product?.name || it.service?.name || "Item",
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      })),
      orderTotal,
    })

    // Prepare credit note PDFs if any
    const creditNotePdfs: { fileName: string; content: Buffer }[] = []
    if (order.creditNotes && order.creditNotes.length > 0) {
      for (let i = 0; i < order.creditNotes.length; i++) {
        const cn = order.creditNotes[i]
        const fileName = `${order.orderCode}_notadicredito${i + 1}.pdf`
        const content = await generateCreditNotePdf({
          workspaceName,
          orderCode: order.orderCode,
          creditNoteCode: cn.creditNoteCode,
          amount: cn.amount,
          reason: cn.reason,
          createdAt: cn.createdAt,
        })
        creditNotePdfs.push({ fileName, content })
      }
    }

    // Send email with invoice (and credit notes if any)
    const emailService = new EmailService()
    const emailSent = await emailService.sendInvoiceEmail({
      to: recipientEmail,
      orderCode: order.orderCode,
      customerName: order.customer.name || "Customer",
      orderTotal,
      invoicePdf,
      creditNotePdfs: creditNotePdfs.length > 0 ? creditNotePdfs : undefined,
      workspaceName,
    })

    if (!emailSent) {
      logger.error(`[SEND_INVOICE] Failed to send email to ${recipientEmail}`)
      return {
        success: false,
        error: "Email sending failed",
        message: "Failed to send the email. Please try again later.",
      }
    }

    logger.info(
      `[SEND_INVOICE] ✅ Invoice sent to ${recipientEmail} for order ${order.orderCode}`
    )

    // Build response message
    let message = `✅ Invoice for order ${order.orderCode} has been emailed to ${recipientEmail}.`
    if (creditNotePdfs.length > 0) {
      message += ` It also includes ${creditNotePdfs.length} credit note(s).`
    }
    message += " Please check your inbox."

    return {
      success: true,
      message,
      sentTo: recipientEmail,
    }
  } catch (error) {
    logger.error("[SEND_INVOICE] Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to send the invoice. Please try again later or contact support.",
    }
  }
}
