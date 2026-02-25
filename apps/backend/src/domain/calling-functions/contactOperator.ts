/**
 * contactOperator - LLM-Callable Function
 *
 * Escalation a operatore umano quando il cliente richiede assistenza personale.
 * Utilizzata quando l'utente chiede: "voglio parlare con operatore", "assistenza umana", etc.
 *
 * @see docs/prompt_agent.md - Line 177: Definizione della calling function
 */

import logger from "../../utils/logger"
import { prisma } from "@echatbot/database"
import { TranslationAgent } from "../../application/agents/TranslationAgent"
import { SecureTokenService } from "../../application/services/secure-token.service"

const translationAgent = new TranslationAgent(prisma)
const secureTokenService = new SecureTokenService()

export interface ContactOperatorRequest {
  phoneNumber: string
  workspaceId: string
  customerId?: string
  reason?: string // Motivo della richiesta (opzionale)
  channel?: string // "widget" | "whatsapp" — routing canale risposta operatore
}

export interface ContactOperatorResult {
  success: boolean
  message: string
  timestamp: string
  ticketId?: string
  error?: string
  summaryAgentExecuted?: boolean
  summaryEmailSent?: boolean
  generatedSummary?: string // 📧 Il riassunto completo generato dal Summary Agent
  conversationMessages?: any[] // 📧 I messaggi della conversazione inviati al Summary Agent
}

/**
 * Registers customer request for human operator contact
 *
 * @param request - Request parameters
 * @returns Result with confirmation message
 */
export async function contactOperator(
  request: ContactOperatorRequest
): Promise<ContactOperatorResult> {
  // Use imported prisma singleton from @echatbot/database
  
  // 📧 Track email sending status (accessible in all scopes)
  let emailSentSuccessfully = false
  
  // 📧 Track Summary Agent data for debug timeline
  let generatedSummary = ""
  let conversationMessages: any[] = []

  try {
    logger.info("📞 contactOperator called with:", {
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
            "We're connecting you with our support team. You will receive a response as soon as possible. Thank you for your patience! 🤝",
          timestamp: new Date().toISOString(),
        }
      }

      // 🚨 DISABLE CHATBOT - Set activeChatbot = false + record handoff metadata
      const originChannel = request.channel || "whatsapp"
      await prisma.customers.update({
        where: { id: customer.id },
        data: {
          activeChatbot: false,
          operatorRequestedAt: new Date(),
          originChannel,
        },
      })

      logger.info("✅ Chatbot disabled for customer:", customer.id)

      // 📋 QUEUE POSITION — assign next position in the operator relay queue
      // Position 1 = served immediately (operator notified below)
      // Position >1 = customer waits; they will be notified when their turn arrives
      let queuePosition = 1
      try {
        const { OperatorRelayService } = require("../../application/services/operator-relay.service")
        const operatorRelayService = new OperatorRelayService(prisma)
        const queueResult = await operatorRelayService.assignQueuePosition(
          request.workspaceId,
          customer.id
        )
        queuePosition = queueResult.position
        logger.info("✅ [contactOperator] Queue position assigned:", {
          customerId: customer.id,
          position: queuePosition,
        })
      } catch (queueError) {
        logger.warn("⚠️ [contactOperator] Failed to assign queue position:", queueError)
      }

      // 🔑 Generate support-chat token (48h, no-login link for operator)
      let supportChatUrl: string | null = null
      try {
        const activeSession = await prisma.chatSession.findFirst({
          where: { customerId: customer.id, status: "active" },
          orderBy: { createdAt: "desc" },
        })
        const supportToken = await secureTokenService.createToken(
          "support_chat",
          request.workspaceId,
          {
            customerId: customer.id,
            sessionId: activeSession?.id,
            channel: originChannel,
          },
          "48h",
          undefined,
          undefined,
          undefined,
          customer.id
        )
        const frontendUrl = process.env.FRONTEND_URL || "https://www.echatbot.ai"
        supportChatUrl = `${frontendUrl}/support-chat?token=${supportToken}`
        logger.info("✅ [contactOperator] Support chat URL generated:", { supportChatUrl })
      } catch (tokenError) {
        logger.warn("⚠️ [contactOperator] Failed to generate support chat token:", tokenError)
      }

      // 🆕 GET WORKSPACE (needed for both email and WhatsApp)
      const workspace = await prisma.workspace.findUnique({
        where: { id: request.workspaceId },
        select: {
          name: true,
          operatorContactMethod: true,
          operatorWhatsappNumber: true,
          operatorEmail: true, // 📧 Email operatore per notifiche
          hasHumanSupport: true,
          humanSupportInstructions: true, // ✅ Message to send to customer when escalating
          frustrationEscalationInstructions: true, // 🎯 Triggers for when to escalate (not the message!)
          whatsappSettings: {
            select: { adminEmail: true },
          },
        },
      })

      // 🚨 CHECK: hasHumanSupport must be true
      if (!workspace?.hasHumanSupport) {
        logger.warn("⚠️ [contactOperator] Human support disabled for workspace:", request.workspaceId)
        return {
          success: false,
          message: "Human support is not available at the moment. Please try again later.",
          timestamp: new Date().toISOString(),
          error: "Human support disabled for this workspace"
        }
      }

      // �📧 SEND EMAIL TO AGENT with summary of last hour conversation
      let chatSummary = "" // 📧 Declare chatSummary in outer scope
      
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

          // 📧 Store messages for debug timeline
          conversationMessages = messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt
          }))

          // Generate summary using SummaryAgentLLM
          // NOTE: We assign to the OUTER chatSummary variable (declared at line 131)
          // so that both email AND WhatsApp notifications can use the generated summary.

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
                createdAt: msg.createdAt, // Use createdAt, not timestamp
              }))

              // Generate summary
              logger.info("🤖 [contactOperator] Calling SummaryAgentLLM", {
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
                  "✅ [contactOperator] Summary generated successfully",
                  {
                    summaryLength: summaryResult.summary.length,
                  }
                )

                // 🔧 WhatsApp: Skip Widget Security - email summary is internal (no customer-facing translation)
                // contactOperator is WhatsApp-only feature (human operator request)
                // The summary is internal (for operator) so no need for customer-facing translation
                const finalSummary = summaryResult.summary
                
                logger.info(
                  "⏭️ [contactOperator] Skipping Translation/Security (internal summary for operator)"
                )
                
                // If summary is empty, throw error to trigger fallback
                if (!finalSummary || finalSummary.trim().length === 0) {
                  throw new Error("Summary generated but empty")
                }

                chatSummary = `
Cliente: ${customer.name}
Telefono: ${customer.phone}
Email: ${customer.email || "N/A"}
Data richiesta: ${new Date().toLocaleString("it-IT")}
${request.reason ? `\nMotivo: ${request.reason}` : ""}

📋 Riassunto conversazione (ultima ora - ${messages.length} messaggi):
${finalSummary}
                `.trim()

                // 📧 Store generated summary for debug timeline
                generatedSummary = chatSummary

                logger.info(
                  "✅ [contactOperator] Summary processed successfully"
                )
              } else {
                throw new Error(
                  summaryResult.error || "Summary generation failed"
                )
              }
            } catch (summaryError) {
              // Fallback to raw message list if summary generation fails
              logger.warn(
                "⚠️ [contactOperator] Summary generation failed, falling back to raw history:",
                summaryError
              )

              const messageList = messages
                .map((msg, idx) => {
                  const role = msg.role === "user" ? "Cliente" : "Bot"
                  const timestamp = new Date(msg.createdAt).toLocaleString(
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
            logger.warn(
              "⚠️ No messages found in last hour for customer:",
              customer.id
            )
            chatSummary = `
Cliente: ${customer.name}
Telefono: ${customer.phone}
Email: ${customer.email || "N/A"}
Data richiesta: ${new Date().toLocaleString("it-IT")}
${request.reason ? `\nMotivo: ${request.reason}` : ""}

ℹ️ Nessuna conversazione recente nell'ultima ora.
            `.trim()
          }

          // Workspace config already loaded at the beginning

          logger.info("🔍 [contactOperator] Workspace config loaded:", {
            workspaceId: request.workspaceId,
            workspaceName: workspace?.name,
            operatorContactMethod: workspace?.operatorContactMethod,
            operatorWhatsappNumber: workspace?.operatorWhatsappNumber,
            hasWhatsappSettings: !!workspace?.whatsappSettings,
            adminEmail: workspace?.whatsappSettings?.adminEmail || "NOT SET",
          })

          // 📧 EMAIL NOTIFICATION (if method = "email")
          if (workspace?.operatorContactMethod === "email") {
            // Import EmailService
            const {
              EmailService,
            } = require("../../application/services/email.service")
            const emailService = new EmailService()

            // 🎯 Priority: agent email → workspace operatorEmail → adminEmail
            const targetEmail =
              customer.sales?.email ||
              workspace.operatorEmail ||
              workspace.whatsappSettings?.adminEmail
            const targetName = "Operatore"

            logger.info("✅ [contactOperator] Sending email to operator:", {
              operatorEmail: targetEmail,
              fromWorkspaceEmail: workspace.whatsappSettings?.adminEmail,
            })

            if (targetEmail) {
              try {
                const emailResult = await emailService.sendOperatorNotificationEmail({
                  to: targetEmail,
                  customerName: customer.name,
                  chatSummary: supportChatUrl
                    ? `${chatSummary}\n\n🔗 LINK DIRETTO CHAT (no login, valido 48h):\n${supportChatUrl}`
                    : chatSummary,
                  chatId: session?.id,
                  workspaceName: workspace.name,
                  subject: `🚨 Richiesta Operatore - ${customer.name}`,
                  fromEmail: workspace.whatsappSettings?.adminEmail,
                })

                if (emailResult) {
                  logger.info("✅ [contactOperator] Email sent successfully", {
                    targetEmail,
                    targetName,
                    customerName: customer.name,
                  })
                  emailSentSuccessfully = true
                } else {
                  logger.error("❌ [contactOperator] Email sending FAILED (returned false) to:", targetEmail)
                }
              } catch (emailError) {
                logger.error("❌ [contactOperator] Email sending EXCEPTION:", emailError)
              }
            }
          }
        }

// 📱 WHATSAPP NOTIFICATION — sent whenever operatorWhatsappNumber is configured
        // (independent of operatorContactMethod: if a WA number is set, we always notify)
        if (workspace?.operatorWhatsappNumber || (customer.salesId && customer.sales?.phone)) {
          logger.info("📱 [contactOperator] WhatsApp notification enabled", {
            hasWorkspaceNumber: !!workspace?.operatorWhatsappNumber,
            hasSalesPhone: !!(customer.salesId && customer.sales?.phone),
          })

          // PRIORITY LOGIC (Andrea's spec):
          // 1. If customer has salesId → send to agent's phone
          // 2. Otherwise → send to workspace.operatorWhatsappNumber
          
          let targetPhoneNumber: string | null = null
          let targetName = "Operatore"

          if (customer.salesId && customer.sales?.phone) {
            // ✅ Customer has assigned agent → send to agent
            targetPhoneNumber = customer.sales.phone
            targetName = `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
            logger.info("✅ [contactOperator] Sending WhatsApp to assigned agent:", {
              agentName: targetName,
              agentPhone: targetPhoneNumber,
            })
          } else if (workspace.operatorWhatsappNumber) {
            // ❌ No agent → send to generic operator
            targetPhoneNumber = workspace.operatorWhatsappNumber
            logger.info("✅ [contactOperator] Sending WhatsApp to generic operator:", {
              operatorPhone: targetPhoneNumber,
            })
          } else {
            logger.warn("⚠️ [contactOperator] WhatsApp method selected but no operator number configured")
          }

          if (targetPhoneNumber) {
            try {
              // Create WhatsApp message with AI summary
              const whatsappMessage = `
🔔 *RICHIESTA ASSISTENZA OPERATORE*

⚠️ *ATTENZIONE*: Il cliente *${customer.name}* ha richiesto di parlare con un operatore.

📋 *Dettagli della richiesta*:
• Cliente: ${customer.name}
• Telefono: ${customer.phone}
• Email: ${customer.email || "N/A"}
• Data/Ora: ${new Date().toLocaleString("it-IT")}
• Posizione in coda: *#${queuePosition}*
${request.reason ? `• Motivo: ${request.reason}` : ""}

🤖 *Riassunto AI della conversazione* (ultima ora):

${chatSummary}

${supportChatUrl ? `💬 *Rispondi direttamente (link diretto, no login, valido 48h)*:\n${supportChatUrl}` : ""}

💬 *I messaggi del cliente ti saranno inoltrati qui direttamente.*
Rispondi a questo numero per rispondere al cliente.
Scrivi *END* quando la conversazione è terminata.

---
_Questa notifica è stata generata automaticamente dal sistema eChatbot quando un cliente ha richiesto assistenza operatore._
              `.trim()
              
              await prisma.whatsAppQueue.create({
                data: {
                  workspaceId: request.workspaceId,
                  customerId: customer.id, // System customer for billing
                  phoneNumber: targetPhoneNumber, // 🎯 Operator/agent number
                  messageContent: whatsappMessage,
                  status: "pending",
                  channel: "whatsapp",
                },
              })

              logger.info("✅ [contactOperator] WhatsApp message queued successfully", {
                targetPhoneNumber,
                targetName,
                customerName: customer.name,
              })
            } catch (whatsappError) {
              logger.error("❌ [contactOperator] Failed to queue WhatsApp message:", whatsappError)
            }
          }
        }
      } catch (emailError) {
        logger.error(
          "❌ [contactOperator] Failed to send email to agent:",
          emailError
        )
        // Don't fail the entire operation if email fails
      }

      // ⚠️ Escalation fallback warning: if no contact method is configured, nobody gets notified
      if (!workspace?.operatorContactMethod) {
        logger.warn("⚠️ [contactOperator] NO operatorContactMethod configured — operator will NOT be notified!", {
          workspaceId: request.workspaceId,
          customerName: customer.name,
        })
      }

      // Create escalation record (or update existing conversation metadata)
      // For now, we just log and return success
      // Future: Create ticket in CRM, notify operators via email/Slack, etc.

      const ticketId = `TICKET-${Date.now()}`

      logger.info("✅ contactOperator escalation registered:", {
        ticketId,
        customerId: customer?.id,
        phoneNumber: request.phoneNumber,
        activeChatbot: false,
      })

      await prisma.$disconnect()

      // 📝 Build response message with variable replacement (Andrea's spec)
      // Use humanSupportInstructions (message to send) NOT frustrationEscalationInstructions (triggers)
      let responseMessage = workspace?.humanSupportInstructions || 
        "Hello {{nameUser}}, I'm connecting you with our support team. They will contact you as soon as possible. We're disabling the chatbot until you receive a response. Thank you for your patience! 🤝"

      // 🔧 Replace {{nameUser}} variable (Andrea's requirement)
      responseMessage = responseMessage.replace(/\{\{nameUser\}\}/g, customer.name)
      
      // 🔧 Replace other common variables if present
      const agentName = customer.sales 
        ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim() 
        : "Support Team"
      const agentPhone = customer.sales?.phone || workspace?.operatorWhatsappNumber || "N/A"
      const agentEmail = customer.sales?.email || workspace?.operatorEmail || workspace?.whatsappSettings?.adminEmail || "N/A"

      responseMessage = responseMessage
        .replace(/\{\{agentName\}\}/g, agentName)
        .replace(/\{\{agentPhone\}\}/g, agentPhone)
        .replace(/\{\{agentEmail\}\}/g, agentEmail)
      
      logger.info("✅ [contactOperator] Response message prepared:", {
        hasCustomMessage: !!workspace?.humanSupportInstructions,
        customerName: customer.name,
        replacedNameUser: responseMessage.includes(customer.name),
      })

      // 🌍 Translate response to customer language via TranslationAgent
      const customerLanguage = customer.language || "en"
      try {
        const translationResult = await translationAgent.process({
          workspaceId: request.workspaceId,
          message: responseMessage,
          targetLanguage: customerLanguage,
          customerName: customer.name || "Customer",
          customerId: customer.id,
          channel: "whatsapp",
        })
        if (translationResult.message) {
          responseMessage = translationResult.message
        }
        logger.info("✅ [contactOperator] Response translated to:", { customerLanguage })
      } catch (translationError) {
        logger.warn("⚠️ [contactOperator] Translation failed, using untranslated message", {
          error: translationError,
          customerLanguage,
        })
        // Keep the variable-replaced but untranslated message (graceful degradation)
      }

      return {
        success: true,
        message: responseMessage,
        timestamp: new Date().toISOString(),
        ticketId,
        summaryAgentExecuted: true, // Indica che il Summary Agent è stato eseguito
        summaryEmailSent: emailSentSuccessfully, // Indica se l'email di riepilogo è stata inviata
        generatedSummary, // 📧 Il riassunto completo per debug timeline
        conversationMessages // 📧 I messaggi della conversazione per debug timeline
      }
    } catch (dbError) {
      logger.error("❌ Database error in contactOperator:", dbError)
      await prisma.$disconnect()

      // Still return success - escalation intent is recorded in logs
      return {
        success: true,
        message:
          "We're connecting you with our support team. You will receive a response as soon as possible. Thank you for your patience! 🤝",
        timestamp: new Date().toISOString(),
        summaryAgentExecuted: false, // Summary Agent non eseguito in caso di errore DB
        summaryEmailSent: false,
        generatedSummary: "", // Nessun riassunto in caso di errore
        conversationMessages: [] // Nessun messaggio in caso di errore
      }
    }
  } catch (error) {
    logger.error("❌ Error in contactOperator:", error)
    return {
      success: false,
      message: "Si è verificato un errore. Riprova più tardi.",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
