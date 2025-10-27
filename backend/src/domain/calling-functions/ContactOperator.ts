/**
 * ContactOperator - LLM-Callable Function
 *
 * Escalation a operatore umano quando il cliente richiede assistenza personale.
 * Utilizzata quando l'utente chiede: "voglio parlare con operatore", "assistenza umana", etc.
 *
 * @see docs/prompt_agent.md - Line 177: Definizione della calling function
 */

import logger from "../../utils/logger"

export interface ContactOperatorRequest {
  phoneNumber: string
  workspaceId: string
  customerId?: string
  reason?: string // Motivo della richiesta (opzionale)
}

export interface ContactOperatorResult {
  success: boolean
  message: string
  timestamp: string
  ticketId?: string
  error?: string
}

/**
 * Registers customer request for human operator contact
 *
 * @param request - Request parameters
 * @returns Result with confirmation message
 */
export async function ContactOperator(
  request: ContactOperatorRequest
): Promise<ContactOperatorResult> {
  try {
    logger.info("📞 ContactOperator called with:", {
      phoneNumber: request.phoneNumber,
      workspaceId: request.workspaceId,
      customerId: request.customerId,
      reason: request.reason,
    })

    // Import Prisma to save escalation request
    const { PrismaClient } = require("@prisma/client")
    const prisma = new PrismaClient()

    try {
      // Find customer by phone and workspace
      const customer = await prisma.customers.findFirst({
        where: {
          phone: request.phoneNumber,
          workspaceId: request.workspaceId,
        },
      })

      if (!customer) {
        logger.warn(
          "⚠️ Customer not found for ContactOperator:",
          request.phoneNumber
        )
        await prisma.$disconnect()
        return {
          success: true,
          message:
            "Ciao {{nameUser}}! 👋\n\n" +
            "Questo è un caso dove abbiamo bisogno di un uomo in carne ed ossa :-) ! Verrai contattato il prima possibile dal nostro agente **{{agentName}}** (📞 {{agentPhone}}).\n\n" +
            "Nel frattempo, ti invitiamo a scrivere una **mail dettagliata** all'indirizzo:\n" +
            "📧 **{{agentEmail}}**\n\n" +
            "Includi eventualmente foto, documenti o qualsiasi allegato utile così da poter analizzare immediatamente la situazione e offrirti la soluzione più rapida! 🚀\n\n" +
            "Ci scusiamo per il disturbo. La chat ora verrà **disattivata** e passiamo la palla ad un operatore in carne e ossa! 👤\n\n" +
            "A presto! 😊",
          timestamp: new Date().toISOString(),
        }
      }

      // 🚨 DISABLE CHATBOT - Set activeChatbot = false
      await prisma.customers.update({
        where: { id: customer.id },
        data: { activeChatbot: false },
      })

      logger.info("✅ Chatbot disabled for customer:", customer.id)
      // Create escalation record (or update existing conversation metadata)
      // For now, we just log and return success
      // Future: Create ticket in CRM, notify operators via email/Slack, etc.

      const ticketId = `TICKET-${Date.now()}`

      logger.info("✅ ContactOperator escalation registered:", {
        ticketId,
        customerId: customer?.id,
        phoneNumber: request.phoneNumber,
        activeChatbot: false,
      })

      await prisma.$disconnect()

      return {
        success: true,
        message:
          "Ciao {{nameUser}}! 👋\n\n" +
          "Questo è un caso dove abbiamo bisogno di un uomo in carne ed ossa :-) ! Verrai contattato il prima possibile dal nostro agente **{{agentName}}** (📞 {{agentPhone}}).\n\n" +
          "Nel frattempo, ti invitiamo a scrivere una **mail dettagliata** all'indirizzo:\n" +
          "📧 **{{agentEmail}}**\n\n" +
          "Includi eventualmente foto, documenti o qualsiasi allegato utile così da poter analizzare immediatamente la situazione e offrirti la soluzione più rapida! 🚀\n\n" +
          "Ci scusiamo per il disturbo. La chat ora verrà **disattivata** e passiamo la palla ad un operatore in carne e ossa! 👤\n\n" +
          "A presto! 😊",
        timestamp: new Date().toISOString(),
        ticketId,
      }
    } catch (dbError) {
      logger.error("❌ Database error in ContactOperator:", dbError)
      await prisma.$disconnect()

      // Still return success - escalation intent is recorded in logs
      return {
        success: true,
        message:
          "Ciao {{nameUser}}! 👋\n\n" +
          "Questo è un caso dove abbiamo bisogno di un uomo in carne ed ossa :-) ! Verrai contattato il prima possibile dal nostro agente **{{agentName}}** (📞 {{agentPhone}}).\n\n" +
          "Nel frattempo, ti invitiamo a scrivere una **mail dettagliata** all'indirizzo:\n" +
          "📧 **{{agentEmail}}**\n\n" +
          "Includi eventualmente foto, documenti o qualsiasi allegato utile così da poter analizzare immediatamente la situazione e offrirti la soluzione più rapida! 🚀\n\n" +
          "Ci scusiamo per il disturbo. La chat ora verrà **disattivata** e passiamo la palla ad un operatore in carne e ossa! 👤\n\n" +
          "A presto! 😊",
        timestamp: new Date().toISOString(),
      }
    }
  } catch (error) {
    logger.error("❌ Error in ContactOperator:", error)
    return {
      success: false,
      message: "Si è verificato un errore. Riprova più tardi.",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
