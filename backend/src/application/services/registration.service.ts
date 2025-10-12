import { PrismaClient } from "@prisma/client"
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

      // Get the after-registration message from workspace settings
      const afterRegistrationMessages =
        ((workspaceSettings as any).afterRegistrationMessages as Record<
          string,
          string
        >) || {}

      // Normalize the language code for lookup
      const normalizedLanguage = this.normalizeLanguageCode(customerLanguage)

      // Get message in customer's language or fall back to English
      let afterRegistrationMessage =
        afterRegistrationMessages[normalizedLanguage] ||
        afterRegistrationMessages["en"]

      // If no message found in workspace settings, use default
      if (!afterRegistrationMessage) {
        afterRegistrationMessage =
          this.getDefaultAfterRegistrationMessage(normalizedLanguage)
      }

      // Replace placeholders
      afterRegistrationMessage = afterRegistrationMessage.replace(
        /\[nome\]/gi,
        firstName
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
          await this.messageRepository.saveMessage({
            workspaceId: customer.workspaceId,
            phoneNumber: customer.phone,
            message: "", // No incoming message
            response: afterRegistrationMessage,
            direction: "OUTBOUND",
            agentSelected: "CHATBOT", // Mark this message as coming from the CHATBOT agent
          })

          logger.info(
            `After-registration message ${whatsappSent ? "sent" : "saved"} for customer ${customerId}`
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
      return "Grazie per esserti registrato, [nome]! Come ti posso aiutare oggi? Vuoi vedere i tuoi ordini? Le offerte? O hai bisogno di altre informazioni?"
    }
    if (languageCode === "es") {
      return "¡Gracias por registrarte, [nome]! ¿Cómo puedo ayudarte hoy? ¿Quieres ver tus pedidos? ¿Las ofertas? ¿O necesitas otra información?"
    }
    if (languageCode === "fr") {
      return "Merci de vous être inscrit, [nome] ! Comment puis-je vous aider aujourd'hui ? Voulez-vous voir vos commandes ? Les offres ? Ou avez-vous besoin d'autres informations ?"
    }
    if (languageCode === "de") {
      return "Danke für Ihre Registrierung, [nome]! Wie kann ich Ihnen heute helfen? Möchten Sie Ihre Bestellungen sehen? Die Angebote? Oder benötigen Sie andere Informationen?"
    }
    if (languageCode === "pt") {
      return "Obrigado por se registrar, [nome]! Como posso ajudá-lo hoje? Quer ver seus pedidos? As ofertas? Ou precisa de outras informações?"
    }
    // Default English
    return "Thank you for registering, [nome]! How can I help you today? Would you like to see your orders? The offers? Or do you need other information?"
  }
}
