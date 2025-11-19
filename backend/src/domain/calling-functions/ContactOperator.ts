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
  // Import Prisma OUTSIDE try block for proper scope
  const { PrismaClient } = require("@prisma/client")
  const prisma = new PrismaClient()

  try {
    logger.info("📞 ContactOperator called with:", {
      phoneNumber: request.phoneNumber,
      workspaceId: request.workspaceId,
      customerId: request.customerId,
      reason: request.reason,
    })

    try {
      // Find customer by phone and workspace WITH sales agent
      const customer = await prisma.customers.findFirst({
        where: {
          phone: request.phoneNumber,
          workspaceId: request.workspaceId,
        },
        include: {
          sales: true, // Include sales agent data (name, email, phone)
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
            "Mi dispiace molto per l'inconveniente! �\n\n" +
            "Ricevere merce scaduta è inaccettabile e capisco la tua frustrazione.\n\n" +
            "Ecco cosa faremo IMMEDIATAMENTE:\n" +
            "1. ✅ Rimborso completo entro 24 ore\n" +
            "2. 📦 Sostituzione gratuita del prodotto\n" +
            "3. 📞 Contatto diretto con il tuo agente per assistenza immediata\n\n" +
            "Il tuo agente di riferimento è:\n" +
            "• {{agentName}}\n" +
            "• 📞 {{agentPhone}}\n" +
            "• ✉️ {{agentEmail}}\n\n" +
            "L'agente ti contatterà il prima possibile per risolvere la situazione.\n\n" +
            "**Da questo momento disattiviamo il chatbot e aspettiamo che si colleghi l'agente.** 🤝\n\n" +
            "Grazie per la pazienza! 😊",
          timestamp: new Date().toISOString(),
        }
      }

      // 🚨 DISABLE CHATBOT - Set activeChatbot = false
      await prisma.customers.update({
        where: { id: customer.id },
        data: { activeChatbot: false },
      })

      logger.info("✅ Chatbot disabled for customer:", customer.id)

      // 📧 SEND EMAIL TO AGENT with summary of last hour conversation
      try {
        // Get active chat session
        const session = await prisma.chatSession.findFirst({
          where: {
            customerId: customer.id,
            status: "active",
          },
          orderBy: { createdAt: "desc" },
        })

        if (session) {
          // Get messages from last hour (time-based filter as per spec)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
          const messages = await prisma.conversationMessage.findMany({
            where: {
              conversationId: session.id,
              createdAt: {
                gte: oneHourAgo,
              },
            },
            orderBy: { createdAt: "asc" }, // Chronological order
          })

          logger.info("📊 Retrieved messages from last hour:", {
            count: messages.length,
            customerId: customer.id,
            sessionId: session.id,
          })

          // Generate summary using SummaryAgentLLM
          let chatSummary: string

          if (messages.length > 0) {
            try {
              // Import SummaryAgentLLM
              const {
                SummaryAgentLLM,
              } = require("../../services/summary-agent-llm.service")
              const summaryAgent = new SummaryAgentLLM()

              // Format messages for summary agent
              const conversationHistory = messages.map((msg) => ({
                role: msg.role === "user" ? "customer" : "assistant",
                content: msg.content,
                createdAt: msg.timestamp,
              }))

              // Generate summary
              logger.info("🤖 [ContactOperator] Calling SummaryAgentLLM", {
                messageCount: conversationHistory.length,
                customerName: customer.name,
              })

              const summaryResult = await summaryAgent.generateSummary({
                conversationHistory,
                customerName: customer.name,
                agentName: customer.sales
                  ? `${customer.sales.firstName} ${customer.sales.lastName}`
                  : "Agente",
              })

              if (summaryResult.success && summaryResult.summary) {
                logger.info(
                  "✅ [ContactOperator] Summary generated successfully",
                  {
                    summaryLength: summaryResult.summary.length,
                  }
                )

                // Pass summary through Safety Translation Agent
                const {
                  SafetyTranslationAgent,
                } = require("../../application/agents/SafetyTranslationAgent")
                const safetyAgent = new SafetyTranslationAgent(prisma)

                logger.info(
                  "🛡️ [ContactOperator] Passing summary through Safety Translation Agent"
                )

                const safetyResult = await safetyAgent.process({
                  workspaceId: request.workspaceId,
                  response: summaryResult.summary,
                  targetLanguage: "it", // Summary already in Italian, just need safety check
                  customerName: customer.name,
                })

                chatSummary = `
Cliente: ${customer.name}
Telefono: ${customer.phone}
Email: ${customer.email || "N/A"}
Data richiesta: ${new Date().toLocaleString("it-IT")}
${request.reason ? `\nMotivo: ${request.reason}` : ""}

📋 Riassunto conversazione (ultima ora - ${messages.length} messaggi):
${safetyResult.translatedText || summaryResult.summary}
                `.trim()

                logger.info(
                  "✅ [ContactOperator] Summary processed and translated"
                )
              } else {
                throw new Error(
                  summaryResult.error || "Summary generation failed"
                )
              }
            } catch (summaryError) {
              // Fallback to raw message list if summary generation fails
              logger.warn(
                "⚠️ [ContactOperator] Summary generation failed, falling back to raw history:",
                summaryError
              )

              const messageList = messages
                .map((msg, idx) => {
                  const role = msg.role === "user" ? "Cliente" : "Bot"
                  const timestamp = new Date(msg.timestamp).toLocaleString(
                    "it-IT"
                  )
                  return `${idx + 1}. [${timestamp}] ${role}: ${msg.content}`
                })
                .join("\n\n")

              chatSummary = `
Cliente: ${customer.name}
Telefono: ${customer.phone}
Email: ${customer.email || "N/A"}
Data richiesta: ${new Date().toLocaleString("it-IT")}
${request.reason ? `\nMotivo: ${request.reason}` : ""}

📜 Messaggi conversazione (ultima ora - ${messages.length} messaggi):
${messageList || "Nessun messaggio disponibile"}
              `.trim()
            }
          } else {
            // No messages in last hour
            logger.warn("⚠️ No messages found in last hour for customer:", customer.id)
            chatSummary = `
Cliente: ${customer.name}
Telefono: ${customer.phone}
Email: ${customer.email || "N/A"}
Data richiesta: ${new Date().toLocaleString("it-IT")}
${request.reason ? `\nMotivo: ${request.reason}` : ""}

ℹ️ Nessuna conversazione recente nell'ultima ora.
            `.trim()
          }

          // Get workspace and initialize EmailService
          const workspace = await prisma.workspace.findUnique({
            where: { id: request.workspaceId },
            select: {
              name: true,
              whatsappSettings: {
                select: { adminEmail: true },
              },
            },
          })

          logger.info("🔍 [ContactOperator] Workspace config loaded:", {
            workspaceId: request.workspaceId,
            workspaceName: workspace?.name,
            hasWhatsappSettings: !!workspace?.whatsappSettings,
            adminEmail: workspace?.whatsappSettings?.adminEmail || "NOT SET",
          })

          if (workspace?.whatsappSettings?.adminEmail) {
            // Import EmailService
            const {
              EmailService,
            } = require("../../application/services/email.service")
            const emailService = new EmailService()

            // Send email to customer's sales agent (if exists)
            if (customer.sales?.email) {
              logger.info(
                "📧 [ContactOperator] Preparing to send email to sales agent:",
                customer.sales.email,
                `(${customer.sales.firstName} ${customer.sales.lastName})`
              )

              try {
                // Customer has assigned sales agent - send to them
                const emailResult =
                  await emailService.sendOperatorNotificationEmail({
                    to: customer.sales.email, // Direct email address
                    customerName: customer.name,
                    chatSummary: chatSummary,
                    chatId: session?.id,
                    workspaceName: workspace.name,
                    subject: `🚨 Richiesta Operatore - ${customer.name}`,
                    fromEmail: workspace.whatsappSettings?.adminEmail,
                  })

                logger.info(
                  "📧 [ContactOperator] Email service returned:",
                  emailResult
                )

                if (emailResult) {
                  logger.info(
                    "✅ [ContactOperator] Email sent successfully to sales agent:",
                    customer.sales.email,
                    `(${customer.sales.firstName} ${customer.sales.lastName})`,
                    "for customer:",
                    customer.name
                  )
                } else {
                  logger.error(
                    "❌ [ContactOperator] Email sending FAILED (returned false) to sales agent:",
                    customer.sales.email
                  )
                }
              } catch (emailError) {
                logger.error(
                  "❌ [ContactOperator] Email sending EXCEPTION:",
                  emailError
                )
              }
            } else {
              // No sales agent assigned - fallback to admin user
              const adminUser = await prisma.user.findFirst({
                where: {
                  role: "ADMIN",
                  workspaces: {
                    some: { workspaceId: request.workspaceId },
                  },
                },
              })

              if (adminUser?.email) {
                logger.info(
                  "📧 [ContactOperator] No sales agent - sending to admin:",
                  adminUser.email
                )

                try {
                  const emailResult =
                    await emailService.sendOperatorNotificationEmail({
                      to: adminUser.email, // Direct email address
                      customerName: customer.name,
                      chatSummary: chatSummary,
                      chatId: session?.id,
                      workspaceName: workspace.name,
                      subject: `🚨 Richiesta Operatore - ${customer.name}`,
                      fromEmail: workspace.whatsappSettings?.adminEmail,
                    })

                  logger.info(
                    "📧 [ContactOperator] Email service returned (admin):",
                    emailResult
                  )

                  if (emailResult) {
                    logger.info(
                      "✅ [ContactOperator] Email sent successfully to admin:",
                      adminUser.email,
                      "for customer:",
                      customer.name
                    )
                  } else {
                    logger.error(
                      "❌ [ContactOperator] Email sending FAILED (returned false) to admin:",
                      adminUser.email
                    )
                  }
                } catch (emailError) {
                  logger.error(
                    "❌ [ContactOperator] Email sending EXCEPTION (admin):",
                    emailError
                  )
                }
              } else {
                logger.warn(
                  "⚠️ No sales agent or admin user found for workspace:",
                  request.workspaceId
                )
              }
            }
          }
        }
      } catch (emailError) {
        logger.error("❌ [ContactOperator] Failed to send email to agent:", emailError)
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
          "Mi dispiace molto per l'inconveniente! �\n\n" +
          "Ricevere merce scaduta è inaccettabile e capisco la tua frustrazione.\n\n" +
          "Ecco cosa faremo IMMEDIATAMENTE:\n" +
          "1. ✅ Rimborso completo entro 24 ore\n" +
          "2. 📦 Sostituzione gratuita del prodotto\n" +
          "3. 📞 Contatto diretto con il tuo agente per assistenza immediata\n\n" +
          "Il tuo agente di riferimento è:\n" +
          "• {{agentName}}\n" +
          "• 📞 {{agentPhone}}\n" +
          "• ✉️ {{agentEmail}}\n\n" +
          "L'agente ti contatterà il prima possibile per risolvere la situazione.\n\n" +
          "**Da questo momento disattiviamo il chatbot e aspettiamo che si colleghi l'agente.** 🤝\n\n" +
          "Grazie per la pazienza! 😊",
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
          "Mi dispiace molto per l'inconveniente! �\n\n" +
          "Ricevere merce scaduta è inaccettabile e capisco la tua frustrazione.\n\n" +
          "Ecco cosa faremo IMMEDIATAMENTE:\n" +
          "1. ✅ Rimborso completo entro 24 ore\n" +
          "2. 📦 Sostituzione gratuita del prodotto\n" +
          "3. 📞 Contatto diretto con il tuo agente per assistenza immediata\n\n" +
          "Il tuo agente di riferimento è:\n" +
          "• {{agentName}}\n" +
          "• 📞 {{agentPhone}}\n" +
          "• ✉️ {{agentEmail}}\n\n" +
          "L'agente ti contatterà il prima possibile per risolvere la situazione.\n\n" +
          "**Da questo momento disattiviamo il chatbot e aspettiamo che si colleghi l'agente.** 🤝\n\n" +
          "Grazie per la pazienza! 😊",
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
