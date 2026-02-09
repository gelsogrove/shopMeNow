import { prisma, PrismaClient } from "@echatbot/database"
import { MessageRepository } from "../../repositories/message.repository"
import logger from "../../utils/logger"
import { WhatsAppQueueService } from "../../services/whatsapp-queue.service"

/**
 * ProfileService - Handle profile update and deletion messaging
 *
 * Responsibilities:
 * 1. Send WhatsApp message after profile update ("Dati personali aggiornati")
 * 2. Send WhatsApp message after account soft delete ("Utente cancellato")
 *
 * Pattern: Same as RegistrationService - uses WhatsApp Queue + Security & Translation layer
 */
export class ProfileService {
  private prisma: PrismaClient
  private messageRepository: MessageRepository
  private whatsappQueueService: WhatsAppQueueService

  constructor() {
    this.prisma = prisma
    this.messageRepository = new MessageRepository()
    this.whatsappQueueService = new WhatsAppQueueService(prisma)
  }

  /**
   * Send a WhatsApp message via Queue (NOT direct!)
   * ✅ Passes through Security Agent
   * ✅ Respects Debug Mode
   * ✅ Has billing tracking
   * ✅ Has retry logic
   */
  private async sendWhatsAppMessage(
    phoneNumber: string,
    message: string,
    workspaceId: string,
    customerId: string
  ): Promise<boolean> {
    try {
      logger.info(
        `[PROFILE-WA] 📤 Adding message to queue for ${phoneNumber}`
      )

      // Validate workspace has WhatsApp configured
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          whatsappApiKey: true,
          whatsappPhoneNumber: true,
        },
      })

      if (!workspace || !workspace.whatsappApiKey) {
        logger.error(
          `[PROFILE-WA] WhatsApp settings not found for workspace ${workspaceId}`
        )
        return false
      }

      // 📤 ADD TO QUEUE instead of sending directly!
      const queueEntry = await this.whatsappQueueService.enqueue({
        workspaceId,
        customerId,
        phoneNumber,
        messageContent: message,
      })

      logger.info(`[PROFILE-WA] ✅ Message added to queue`, {
        queueId: queueEntry.id,
        phoneNumber,
        status: "pending",
      })

      return true
    } catch (error) {
      logger.error(`[PROFILE-WA] Error adding message to queue:`, error)
      return false
    }
  }

  /**
   * Send "Dati personali aggiornati" message after profile update
   * ✅ USES Security & Translation layer (MANDATORY)
   *
   * @param customerId The customer ID
   * @returns True if message was sent successfully
   */
  async sendProfileUpdateMessage(customerId: string): Promise<boolean> {
    try {
      logger.info(
        `[PROFILE-UPDATE] 📝 Sending profile update message to customer ${customerId}`
      )

      // Get customer data
      const customer = await this.prisma.customers.findUnique({
        where: { id: customerId },
        include: { workspace: true },
      })

      if (!customer) {
        logger.error(`[PROFILE-UPDATE] Customer ${customerId} not found`)
        return false
      }

      // Get customer language
      const customerLanguage = customer.language || "English"
      const firstName = customer.name.split(" ")[0]

      // Get workspace settings
      const workspaceSettings =
        await this.messageRepository.getWorkspaceSettings(customer.workspaceId)

      if (!workspaceSettings) {
        logger.error(
          `[PROFILE-UPDATE] Workspace settings not found for ${customer.workspaceId}`
        )
        return false
      }

      // Get profile update message from workspace (or use default)
      const profileUpdateMessages =
        ((workspaceSettings as any).profileUpdateMessages as Record<
          string,
          string
        >) || {}

      // Get ENGLISH message from database (or default)
      let profileUpdateMessageEnglish =
        profileUpdateMessages["en"] ||
        this.getDefaultProfileUpdateMessage("en")

      // Replace placeholders
      profileUpdateMessageEnglish = profileUpdateMessageEnglish
        .replace(/\[nome\]/gi, firstName)
        .replace(/\[name\]/gi, firstName)

      // ✅ TRANSLATE via Security & Translation layer (MANDATORY)
      const { LLMService } = require("../../services/llm.service")
      const llmService = new LLMService()

      const normalizedLanguage = this.normalizeLanguageCode(customerLanguage)

      const profileUpdateMessage = await llmService.translateSystemMessage(
        profileUpdateMessageEnglish,
        customer.workspaceId,
        normalizedLanguage,
        undefined,
        "profile_update" // stage name for Safety layer
      )

      logger.info(
        `[PROFILE-UPDATE] ✅ Message translated via Security & Translation layer`,
        {
          customerId,
          language: normalizedLanguage,
          stage: "profile_update",
        }
      )

      // Send the message
      if (customer.phone) {
        try {
          // 1. Send via WhatsApp Queue (NOT direct!)
          const whatsappSent = await this.sendWhatsAppMessage(
            customer.phone,
            profileUpdateMessage,
            customer.workspaceId,
            customer.id
          )

          if (!whatsappSent) {
            logger.warn(
              `[PROFILE-UPDATE] Failed to send message via WhatsApp to ${customer.phone}`
            )
          }

          // 2. Save the outgoing message to history
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

          // Save to conversationMessage table
          await this.prisma.conversationMessage.create({
            data: {
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: "assistant", // Bot response
              content: profileUpdateMessage,
              agentType: "PROFILE_UPDATE_CONFIRMATION",
              tokensUsed: 0,
              debugInfo: JSON.stringify({
                stage: "profile_update",
                translatedViaSecurityLayer: true,
                language: normalizedLanguage,
                firstName: firstName,
                timestamp: new Date().toISOString(),
              }),
            },
          })

          logger.info(
            `[PROFILE-UPDATE] ✅ Message ${whatsappSent ? "sent" : "saved"} for customer ${customerId}`
          )
          return whatsappSent
        } catch (error) {
          logger.error(
            "[PROFILE-UPDATE] Error sending profile update message:",
            error
          )
          return false
        }
      } else {
        logger.error(`[PROFILE-UPDATE] Customer ${customerId} has no phone`)
        return false
      }
    } catch (error) {
      logger.error("[PROFILE-UPDATE] Error sending message:", error)
      return false
    }
  }

  /**
   * Send "Utente cancellato" message after account soft delete
   * ✅ USES Security & Translation layer (MANDATORY)
   *
   * @param customerId The customer ID
   * @returns True if message was sent successfully
   */
  async sendAccountDeleteMessage(customerId: string): Promise<boolean> {
    try {
      logger.info(
        `[ACCOUNT-DELETE] 🗑️ Sending account deletion message to customer ${customerId}`
      )

      // Get customer data
      const customer = await this.prisma.customers.findUnique({
        where: { id: customerId },
        include: { workspace: true },
      })

      if (!customer) {
        logger.error(`[ACCOUNT-DELETE] Customer ${customerId} not found`)
        return false
      }

      // Get customer language
      const customerLanguage = customer.language || "English"
      const firstName = customer.name.split(" ")[0]

      // Get workspace settings
      const workspaceSettings =
        await this.messageRepository.getWorkspaceSettings(customer.workspaceId)

      if (!workspaceSettings) {
        logger.error(
          `[ACCOUNT-DELETE] Workspace settings not found for ${customer.workspaceId}`
        )
        return false
      }

      // Get account delete message from workspace (or use default)
      const accountDeleteMessages =
        ((workspaceSettings as any).accountDeleteMessages as Record<
          string,
          string
        >) || {}

      // Get ENGLISH message from database (or default)
      let accountDeleteMessageEnglish =
        accountDeleteMessages["en"] || this.getDefaultAccountDeleteMessage("en")

      // Replace placeholders
      accountDeleteMessageEnglish = accountDeleteMessageEnglish
        .replace(/\[nome\]/gi, firstName)
        .replace(/\[name\]/gi, firstName)

      // ✅ TRANSLATE via Security & Translation layer (MANDATORY)
      const { LLMService } = require("../../services/llm.service")
      const llmService = new LLMService()

      const normalizedLanguage = this.normalizeLanguageCode(customerLanguage)

      const accountDeleteMessage = await llmService.translateSystemMessage(
        accountDeleteMessageEnglish,
        customer.workspaceId,
        normalizedLanguage,
        undefined,
        "account_delete" // stage name for Safety layer
      )

      logger.info(
        `[ACCOUNT-DELETE] ✅ Message translated via Security & Translation layer`,
        {
          customerId,
          language: normalizedLanguage,
          stage: "account_delete",
        }
      )

      // Send the message
      if (customer.phone) {
        try {
          // 1. Send via WhatsApp Queue (NOT direct!)
          const whatsappSent = await this.sendWhatsAppMessage(
            customer.phone,
            accountDeleteMessage,
            customer.workspaceId,
            customer.id
          )

          if (!whatsappSent) {
            logger.warn(
              `[ACCOUNT-DELETE] Failed to send message via WhatsApp to ${customer.phone}`
            )
          }

          // 2. Save the outgoing message to history
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

          // Save to conversationMessage table
          await this.prisma.conversationMessage.create({
            data: {
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: "assistant", // Bot response
              content: accountDeleteMessage,
              agentType: "ACCOUNT_DELETE_CONFIRMATION",
              tokensUsed: 0,
              debugInfo: JSON.stringify({
                stage: "account_delete",
                translatedViaSecurityLayer: true,
                language: normalizedLanguage,
                firstName: firstName,
                timestamp: new Date().toISOString(),
              }),
            },
          })

          logger.info(
            `[ACCOUNT-DELETE] ✅ Message ${whatsappSent ? "sent" : "saved"} for customer ${customerId}`
          )
          return whatsappSent
        } catch (error) {
          logger.error(
            "[ACCOUNT-DELETE] Error sending account delete message:",
            error
          )
          return false
        }
      } else {
        logger.error(`[ACCOUNT-DELETE] Customer ${customerId} has no phone`)
        return false
      }
    } catch (error) {
      logger.error("[ACCOUNT-DELETE] Error sending message:", error)
      return false
    }
  }

  /**
   * Normalize language code for consistent lookup
   */
  private normalizeLanguageCode(language: string): string {
    if (!language) return "en"

    const upperLanguage = language.toUpperCase()

    // Direct 3-letter code mapping
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

    // Default to English
    return "en"
  }

  /**
   * Get default profile update message in English
   */
  private getDefaultProfileUpdateMessage(languageCode: string): string {
    // Always return English - will be translated by Security & Translation layer
    return "Your personal data has been updated successfully!"
  }

  /**
   * Get default account delete message in English
   */
  private getDefaultAccountDeleteMessage(languageCode: string): string {
    // Always return English - will be translated by Security & Translation layer
    return "Your account has been deleted. Thank you for using our service."
  }
}
