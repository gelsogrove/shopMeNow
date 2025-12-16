/**
 * addOrderNote - Append a customer note to a specific order.
 *
 * Triggered after the customer selects "add note" from the post-order options.
 */

import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"

export interface AddOrderNoteRequest {
  workspaceId: string
  customerId: string
  orderCode: string
  note: string
}

export interface AddOrderNoteResult {
  success: boolean
  message: string
  timestamp: string
  error?: string
}

export async function addOrderNote(
  request: AddOrderNoteRequest
): Promise<AddOrderNoteResult> {
  const { workspaceId, customerId, orderCode, note } = request

  try {
    if (!workspaceId || !customerId || !orderCode || !note?.trim()) {
      return {
        success: false,
        message: "Ho bisogno di una nota valida da aggiungere all'ordine.",
        error: "missing_parameters",
        timestamp: new Date().toISOString(),
      }
    }

    const order = await prisma.orders.findFirst({
      where: {
        workspaceId,
        customerId,
        orderCode,
      },
    })

    if (!order) {
      return {
        success: false,
        message: "Non trovo questo ordine. Puoi indicarmi il codice corretto?",
        error: "order_not_found",
        timestamp: new Date().toISOString(),
      }
    }

    const trimmedNote = note.trim()
    const timestampLabel = new Date().toISOString().replace("T", " ").substring(0, 19)
    const formattedNote = `[${timestampLabel}] ${trimmedNote}`
    const newNotes = order.notes
      ? `${order.notes}\n${formattedNote}`
      : formattedNote

    await prisma.orders.update({
      where: { id: order.id },
      data: { notes: newNotes },
    })

    return {
      success: true,
      message:
        `Perfetto, ho aggiunto la nota all'ordine **${orderCode}**.\n` +
        `Se desideri aggiungere un'altra nota, scrivila pure. Se vuoi vedere la lista ordini digita "ordini".`,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error("❌ Error in addOrderNote:", error)
    return {
      success: false,
      message:
        "C'è stato un problema nell'aggiungere la nota. Puoi riprovare o dirmi se vuoi una strada alternativa?",
      error: error instanceof Error ? error.message : "unknown_error",
      timestamp: new Date().toISOString(),
    }
  } finally {
    await prisma.$disconnect()
  }
}
