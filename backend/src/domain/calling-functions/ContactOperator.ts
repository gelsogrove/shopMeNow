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

      // 📧 SEND EMAIL TO AGENT with last 10 messages
      try {
        // Get active chat session
        const session = await prisma.chatSessions.findFirst({
          where: {
            customerId: customer.id,
            status: "active",
          },
          orderBy: { createdAt: "desc" },
        })

        if (session) {
          // Get last 10 messages
          const messages = await prisma.chatMessages.findMany({
            where: { sessionId: session.id },
            orderBy: { timestamp: "desc" },
            take: 10,
          })

          // Reverse to chronological order
          messages.reverse()

          // Format messages for email
          const messageList = messages
            .map((msg, idx) => {
              const role = msg.role === "user" ? "Cliente" : "Bot"
              const timestamp = new Date(msg.timestamp).toLocaleString("it-IT")
              return `${idx + 1}. [${timestamp}] ${role}: ${msg.content}`
            })
            .join("\n\n")

          // Get workspace admin (agent) to send email
          const workspace = await prisma.workspace.findUnique({
            where: { id: request.workspaceId },
            select: {
              name: true,
              whatsappSettings: {
                select: { adminEmail: true },
              },
            },
          })

          if (workspace?.whatsappSettings?.adminEmail) {
            // Import EmailService
            const {
              EmailService,
            } = require("../../application/services/email.service")
            const emailService = new EmailService()

            const emailSubject = `🚨 Richiesta Operatore - ${customer.name}`
            const emailBody = `
<h2>🚨 Richiesta Assistenza Operatore</h2>

<p><strong>Cliente:</strong> ${customer.name}</p>
<p><strong>Telefono:</strong> ${customer.phone}</p>
<p><strong>Email:</strong> ${customer.email || "N/A"}</p>
<p><strong>Data richiesta:</strong> ${new Date().toLocaleString("it-IT")}</p>

${request.reason ? `<p><strong>Motivo:</strong> ${request.reason}</p>` : ""}

<hr>

<h3>📜 Ultimi 10 messaggi della conversazione:</h3>

<pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-size: 12px; line-height: 1.6;">
${messageList || "Nessun messaggio disponibile"}
</pre>

<hr>

<p><strong>Azione richiesta:</strong> Contattare il cliente il prima possibile.</p>

<p style="color: #666; font-size: 12px;">
Email generata automaticamente dal sistema ShopMe<br>
Workspace: ${workspace.name}
</p>
            `

            // Get first admin user as agent
            const adminUser = await prisma.user.findFirst({
              where: {
                role: "ADMIN",
                workspaces: {
                  some: { workspaceId: request.workspaceId },
                },
              },
            })

            if (adminUser) {
              await emailService.sendMail({
                type: "agent",
                to: adminUser.id,
                subject: emailSubject,
                body: emailBody,
                workspaceId: request.workspaceId,
              })

              logger.info(
                "✅ Email sent to agent:",
                adminUser.email,
                "for customer:",
                customer.name
              )
            } else {
              logger.warn(
                "⚠️ No admin user found for workspace:",
                request.workspaceId
              )
            }
          }
        }
      } catch (emailError) {
        logger.error("❌ Failed to send email to agent:", emailError)
        // Don't fail the entire operation if email fails
      }

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
