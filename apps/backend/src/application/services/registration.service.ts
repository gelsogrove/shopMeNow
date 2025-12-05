import { PrismaClient } from "@echatbot/database"
import { MessageRepository } from "../../repositories/message.repository"
import logger from "../../utils/logger"

/**
 * Service for handling registration-related functionality
 */
export class RegistrationService {
  private prisma: PrismaClient
  private messageRepository: MessageRepository

  constructor() {
    this.prisma = new PrismaClient()
    this.messageRepository = new MessageRepository()
  }

  /**
   * Send a WhatsApp message using workspace settings
   */
  private async sendWhatsAppMessage(
    phoneNumber: string,
    message: string,
    workspaceId: string
  ): Promise<boolean> {
    try {
      logger.info(
        `[REGISTRATION-WA] 📱 Sending after-registration message to ${phoneNumber}`
      )

      // Get workspace WhatsApp settings
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          whatsappApiKey: true,
          whatsappPhoneNumber: true,
        },
      })

      if (!workspace || !workspace.whatsappApiKey) {
        logger.error(
          `[REGISTRATION-WA] WhatsApp settings not found for workspace ${workspaceId}`
        )
        return false
      }

      // Send message via WhatsApp Business API
      const whatsappApiUrl = `https://graph.facebook.com/v18.0/${workspace.whatsappPhoneNumber}/messages`

      const whatsappPayload = {
        messaging_product: "whatsapp",
        to: phoneNumber.replace("+", ""),
        type: "text",
        text: {
          body: message,
        },
      }

      const response = await fetch(whatsappApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${workspace.whatsappApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(whatsappPayload),
      })

      if (!response.ok) {
        const errorData = await response.text()
        logger.error(
          `[REGISTRATION-WA] WhatsApp API error: ${response.status} ${response.statusText} - ${errorData}`
        )
        return false
      }

      const responseData = await response.json()
      logger.info(
        `[REGISTRATION-WA] ✅ Message sent successfully:`,
        responseData
      )

      return true
    } catch (error) {
      logger.error(`[REGISTRATION-WA] Error sending WhatsApp message:`, error)
      return false
    }
  }

  /**
   * Send an after-registration message to a newly registered customer
   * ✅ USES Security & Translation layer (MANDATORY)
   *
   * @param customerId The customer ID
   * @returns True if message was sent successfully
   */
  async sendAfterRegistrationMessage(customerId: string): Promise<boolean> {
    try {
      // Get customer data
      const customer = await this.prisma.customers.findUnique({
        where: {
          id: customerId,
        },
        include: {
          workspace: true,
        },
      })

      if (!customer) {
        logger.error(`Customer with ID ${customerId} not found`)
        return false
      }

      // Get customer language
      const customerLanguage = customer.language || "English"

      // Extract first name
      const firstName = customer.name.split(" ")[0]

      // Get workspace settings
      const workspaceSettings =
        await this.messageRepository.getWorkspaceSettings(customer.workspaceId)
      if (!workspaceSettings) {
        logger.error(
          `Workspace settings not found for workspace ${customer.workspaceId}`
        )
        return false
      }

      // Get the after-registration message from workspace settings (ENGLISH ONLY)
      const afterRegistrationMessages =
        ((workspaceSettings as any).afterRegistrationMessages as Record<
          string,
          string
        >) || {}

      // Get ENGLISH message from database
      let afterRegistrationMessageEnglish = afterRegistrationMessages["en"]

      // If no message found in workspace settings, use default ENGLISH
      if (!afterRegistrationMessageEnglish) {
        afterRegistrationMessageEnglish =
          this.getDefaultAfterRegistrationMessage("en")
      }

      // Replace placeholders in ENGLISH message
      afterRegistrationMessageEnglish = afterRegistrationMessageEnglish.replace(
        /\[nome\]/gi,
        firstName
      )

      // ✅ TRANSLATE via Security & Translation layer (MANDATORY)
      const { LLMService } = require("../../services/llm.service")
      const llmService = new LLMService()

      const normalizedLanguage = this.normalizeLanguageCode(customerLanguage)

      const afterRegistrationMessage = await llmService.translateSystemMessage(
        afterRegistrationMessageEnglish,
        customer.workspaceId,
        normalizedLanguage,
        undefined,
        "registration_confirmation" // stage name for Safety layer
      )

      logger.info(
        `✅ After-registration message translated via Security & Translation layer`,
        {
          customerId,
          language: normalizedLanguage,
          stage: "registration_confirmation",
        }
      )

      // Send the message
      if (customer.phone) {
        try {
          // 1. Send via WhatsApp API
          const whatsappSent = await this.sendWhatsAppMessage(
            customer.phone,
            afterRegistrationMessage,
            customer.workspaceId
          )

          if (!whatsappSent) {
            logger.warn(
              `Failed to send after-registration message via WhatsApp to ${customer.phone}`
            )
          }

          // 2. Save the outgoing message to history (even if WhatsApp failed)
          // 🔧 CRITICAL: Use conversationMessage table (NEW) not message table (OLD)
          // This ensures messages appear in frontend (same as welcome message flow)

          // Get or create chat session
          let chatSession = await this.prisma.chatSession.findFirst({
            where: {
              customerId: customer.id,
              workspaceId: customer.workspaceId,
              status: "active",
            },
          })

          if (!chatSession) {
            chatSession = await this.prisma.chatSession.create({
              data: {
                customerId: customer.id,
                workspaceId: customer.workspaceId,
                status: "active",
              },
            })
          }

          // Save to conversationMessage table (NEW format)
          await this.prisma.conversationMessage.create({
            data: {
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: "assistant", // Bot response
              content: afterRegistrationMessage,
              agentType: "REGISTRATION_CONFIRMATION",
              tokensUsed: 0, // No LLM tokens (static message + translation)
              debugInfo: JSON.stringify({
                stage: "registration_confirmation",
                translatedViaSecurityLayer: true,
                language: normalizedLanguage,
                firstName: firstName,
                timestamp: new Date().toISOString(),
              }),
            },
          })

          logger.info(
            `✅ After-registration message ${whatsappSent ? "sent" : "saved"} for customer ${customerId} (translated via Security layer, saved to conversationMessage)`
          )
          return whatsappSent
        } catch (error) {
          logger.error("Error sending after-registration message:", error)
          return false
        }
      } else {
        logger.error(`Customer ${customerId} has no phone number`)
        return false
      }
    } catch (error) {
      logger.error("Error sending after-registration message:", error)
      return false
    }
  }

  /**
   * Normalize language code for consistent lookup
   */
  private normalizeLanguageCode(language: string): string {
    if (!language) return "en"

    const upperLanguage = language.toUpperCase()

    // Direct 3-letter code mapping (used by our system)
    if (upperLanguage === "IT") return "it"
    if (upperLanguage === "ENG") return "en"
    if (upperLanguage === "ESP") return "es"
    if (upperLanguage === "PRT") return "pt"
    if (upperLanguage === "FR") return "fr"
    if (upperLanguage === "DE") return "de"

    // Fallback: partial string matching
    const lowerCaseLanguage = language.toLowerCase()
    if (lowerCaseLanguage.includes("ital")) return "it"
    if (lowerCaseLanguage.includes("engl") || lowerCaseLanguage.includes("ing"))
      return "en"
    if (lowerCaseLanguage.includes("span") || lowerCaseLanguage.includes("esp"))
      return "es"
    if (lowerCaseLanguage.includes("fran") || lowerCaseLanguage.includes("fr"))
      return "fr"
    if (
      lowerCaseLanguage.includes("deut") ||
      lowerCaseLanguage.includes("germ")
    )
      return "de"
    if (
      lowerCaseLanguage.includes("port") ||
      lowerCaseLanguage.includes("portu")
    )
      return "pt"

    // Default to English if no match
    return "en"
  }

  /**
   * Get default after-registration message in the specified language
   */
  private getDefaultAfterRegistrationMessage(languageCode: string): string {
    if (languageCode === "it") {
      return "Grazie, ti sei registrato con successo! Ti ricontatteremo a breve."
    }
    if (languageCode === "es") {
      return "¡Gracias, te has registrado con éxito! Te contactaremos pronto."
    }
    if (languageCode === "fr") {
      return "Merci, vous vous êtes inscrit avec succès ! Nous vous recontacterons bientôt."
    }
    if (languageCode === "de") {
      return "Danke, Sie haben sich erfolgreich registriert! Wir werden uns bald bei Ihnen melden."
    }
    if (languageCode === "pt") {
      return "Obrigado, você se registrou com sucesso! Entraremos em contato em breve."
    }
    // Default English
    return "Thank you, you have successfully registered! We will get back to you shortly."
  }
}
